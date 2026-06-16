import { useState } from "react";
import {
    ActivityViewId,
    DEFAULT_ACTIVITY_VIEW,
} from "./activity-views";

export function useActivityView() {
    const [currentView, setCurrentView] = useState<ActivityViewId | null>(
        DEFAULT_ACTIVITY_VIEW
    );

    const toggleView = (id: ActivityViewId) =>
        setCurrentView((current) => (current === id ? null : id));

    const showView = (id: ActivityViewId) => setCurrentView(id);

    return { currentView, toggleView, showView };
}
