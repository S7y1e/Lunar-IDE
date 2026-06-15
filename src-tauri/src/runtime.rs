use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tiny_http::{Response, Server};

const RUNTIME_PORT: u16 = 34900;

#[derive(Default)]
pub struct RuntimeBridge(Mutex<bool>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub running: bool,
    pub port: u16,
}

fn status(running: bool) -> RuntimeStatus {
    RuntimeStatus {
        running,
        port: RUNTIME_PORT,
    }
}

// Started once at app launch and lives for the whole app lifetime. The bridge is
// a global localhost endpoint, not tied to any view, so it is never started or
// stopped from the frontend — doing that caused a StrictMode start/stop race that
// could leave the server down while the UI still showed it listening.
pub fn spawn(app: AppHandle, state: &RuntimeBridge) {
    let mut running = state.0.lock().unwrap();
    if *running {
        return;
    }
    let server = match Server::http(("127.0.0.1", RUNTIME_PORT)) {
        Ok(server) => server,
        Err(_) => return,
    };

    std::thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let mut body = String::new();
            let _ = request.as_reader().read_to_string(&mut body);
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) {
                let _ = app.emit("runtime://message", value);
            }
            let _ = request.respond(Response::empty(200));
        }
    });

    *running = true;
}

#[tauri::command]
pub fn runtime_bridge_status(state: State<'_, RuntimeBridge>) -> RuntimeStatus {
    status(*state.0.lock().unwrap())
}
