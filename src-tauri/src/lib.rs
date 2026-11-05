// The window shows the web app. In `tauri dev` that is the dev server (npm run dev, port 3300).
// Installed, it is the Next server bundled with the installer: this process starts it from the
// bundled Node on a free local port and points the window at it. All data (the embedded
// Postgres database and the session secret) lives in %LOCALAPPDATA%\net.algarvebuilders.accounts-manager.
use std::{
  fs,
  net::{SocketAddr, TcpListener, TcpStream},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::Mutex,
  thread::sleep,
  time::{Duration, Instant},
};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

struct Server(Mutex<Option<Child>>);

fn plain(p: PathBuf) -> PathBuf {
  // Windows can hand back \\?\C:\... paths; Node and Next are happier without the prefix.
  let s = p.to_string_lossy().to_string();
  PathBuf::from(s.strip_prefix(r"\\?\").unwrap_or(&s))
}

fn free_port() -> u16 {
  TcpListener::bind("127.0.0.1:0").and_then(|l| l.local_addr()).map(|a| a.port()).expect("no free local port")
}

// Signs the login session. Made once per PC and kept next to the database.
fn auth_secret(data_dir: &Path) -> String {
  let file = data_dir.join("auth-secret");
  if let Ok(s) = fs::read_to_string(&file) {
    let s = s.trim().to_string();
    if s.len() >= 32 {
      return s;
    }
  }
  let mut bytes = [0u8; 32];
  getrandom::fill(&mut bytes).expect("random bytes");
  let secret: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
  let _ = fs::create_dir_all(data_dir);
  let _ = fs::write(&file, &secret);
  secret
}

fn start_server(app: &tauri::AppHandle) -> Result<(Child, u16), String> {
  let resources = plain(app.path().resource_dir().map_err(|e| e.to_string())?.join("app"));
  let data_dir = plain(app.path().app_local_data_dir().map_err(|e| e.to_string())?);
  fs::create_dir_all(&data_dir).map_err(|e| format!("Cannot create {}: {e}", data_dir.display()))?;

  let node = resources.join(if cfg!(windows) { "node.exe" } else { "node" });
  let server_dir = resources.join("server");
  if !node.exists() || !server_dir.join("server.js").exists() {
    return Err(format!("The app files are missing from {}", resources.display()));
  }

  // A GUI app has no console, so Node would inherit invalid output handles: give it a log file instead.
  let log = fs::File::create(data_dir.join("server.log")).map_err(|e| format!("Cannot create the log file: {e}"))?;
  let log_err = log.try_clone().map_err(|e| e.to_string())?;

  let port = free_port();
  let mut cmd = Command::new(&node);
  cmd
    .arg("server.js")
    .current_dir(&server_dir)
    .stdin(Stdio::null())
    .stdout(Stdio::from(log))
    .stderr(Stdio::from(log_err))
    .env("PORT", port.to_string())
    .env("HOSTNAME", "127.0.0.1")
    .env("NODE_ENV", "production")
    .env("ACCOUNTS_DATA_DIR", &data_dir)
    .env("ACCOUNTS_RESOURCES_DIR", &resources)
    .env("AUTH_SECRET", auth_secret(&data_dir));
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
  }
  let mut child = cmd.spawn().map_err(|e| format!("Cannot start the app server: {e}"))?;

  let addr: SocketAddr = ([127, 0, 0, 1], port).into();
  let deadline = Instant::now() + Duration::from_secs(60);
  while Instant::now() < deadline {
    if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
      return Ok((child, port));
    }
    if let Ok(Some(status)) = child.try_wait() {
      return Err(format!("The app server stopped while starting ({status})."));
    }
    sleep(Duration::from_millis(250));
  }
  let _ = child.kill();
  Err("The app server did not start in time.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.set_focus();
      }
    }))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .setup(|app| {
      app.manage(Server(Mutex::new(None)));
      if cfg!(debug_assertions) {
        app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
      }

      // Debug: straight to the dev server. Release: the splash page first, then the bundled server.
      let first = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:3300".parse().unwrap())
      } else {
        WebviewUrl::App("index.html".into())
      };
      let window = WebviewWindowBuilder::new(app, "main", first)
        .title("Accounts Manager")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1024.0, 640.0)
        .center()
        .maximized(true)
        .build()?;

      if !cfg!(debug_assertions) {
        let handle = app.handle().clone();
        std::thread::spawn(move || match start_server(&handle) {
          Ok((child, port)) => {
            *handle.state::<Server>().0.lock().unwrap() = Some(child);
            let _ = window.navigate(format!("http://127.0.0.1:{port}/").parse().unwrap());
          }
          Err(msg) => {
            let text = msg.replace('\\', "\\\\").replace('\'', "\\'");
            let _ = window.eval(format!("document.querySelector('p').textContent = '{text}'"));
          }
        });
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|handle, event| {
    if let RunEvent::Exit = event {
      if let Some(server) = handle.try_state::<Server>() {
        if let Some(mut child) = server.0.lock().unwrap().take() {
          let _ = child.kill();
        }
      }
    }
  });
}
