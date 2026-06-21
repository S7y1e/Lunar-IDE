mod process_guard;
mod project;
mod runtime;
mod studio;
mod terminal;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(terminal::TerminalState::default())
        .manage(process_guard::JobGuard::new())
        .manage(project::ProjectStore::default())
        .manage(runtime::RuntimeBridge::default())
        .invoke_handler(tauri::generate_handler![
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            process_guard::assign_to_job,
            project::project_open,
            project::project_close,
            project::project_snapshot,
            project::project_data_model,
            project::project_write_sourcemap,
            project::project_run_test,
            project::dependencies::project_dependencies,
            project::events::project_events,
            project::search::project_search,
            project::todos::project_todos,
            project::logpoints::logpoints_arm,
            project::logpoints::logpoints_disarm,
            project::client_agent::client_agent_install,
            project::client_agent::client_agent_remove,
            project::callgraph::project_callers,
            project::callgraph::project_callees,
            project::index::project_symbols,
            project::index::project_member_usages,
            runtime::runtime_bridge_status,
            runtime::runtime_enqueue,
            studio::studio_play
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            runtime::spawn(
                app.handle().clone(),
                app.state::<runtime::RuntimeBridge>().inner(),
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
