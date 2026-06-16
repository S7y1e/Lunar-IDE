import { VscClose } from "react-icons/vsc";
import styles from "./toasts.module.scss";
import { Toast } from "./use-toasts";

type Props = {
    toasts: Toast[];
    onDismiss: (id: number) => void;
};

export default function Toasts({ toasts, onDismiss }: Props) {
    if (toasts.length === 0) return null;
    return (
        <div className={styles.toasts}>
            {toasts.map((toast) => (
                <div key={toast.id} className={`${styles.toast} ${styles[toast.kind]}`}>
                    <div className={styles.body}>
                        <div className={styles.message}>{toast.message}</div>
                        {toast.detail && (
                            <div className={styles.detail}>{toast.detail}</div>
                        )}
                        {toast.action && (
                            <button
                                className={styles.action}
                                onClick={() => {
                                    toast.action!.run();
                                    onDismiss(toast.id);
                                }}
                            >
                                {toast.action.label}
                            </button>
                        )}
                    </div>
                    <button
                        className={styles.close}
                        onClick={() => onDismiss(toast.id)}
                        title="Dismiss"
                    >
                        <VscClose size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}
