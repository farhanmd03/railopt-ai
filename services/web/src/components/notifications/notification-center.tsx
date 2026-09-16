import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCircle2, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "react-oidc-context";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/notifications";
import { Notification } from "@/lib/types/notifications";

export function NotificationCenter() {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (!auth.isAuthenticated) return;
      try {
        if (!silent) setIsLoading(true);
        setError(null);
        const data = await getNotifications({ limit: 50 });
        setNotifications(data.items);
        setUnreadCount(data.unread_count);
      } catch (err) {
        console.error("Failed to load notifications", err);
        if (!silent) setError("Unable to load notifications");
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [auth.isAuthenticated],
  );

  // Initial fetch and polling setup
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchNotifications();

      // Poll every 30 seconds for new notifications
      const intervalId = setInterval(() => {
        fetchNotifications(true);
      }, 30000);

      return () => clearInterval(intervalId);
    }
  }, [auth.isAuthenticated, fetchNotifications]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkRead = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await markNotificationRead(id);
    } catch (err) {
      console.error("Failed to mark as read", err);
      // Revert on failure
      fetchNotifications(true);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);

      await markAllNotificationsRead();
    } catch (err) {
      console.error("Failed to mark all as read", err);
      // Revert on failure
      fetchNotifications(true);
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return (
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " " +
      date.toLocaleDateString()
    );
  };

  return (
    <div className="relative" ref={popoverRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="text-muted-foreground hover:text-foreground h-8 w-8 relative rounded-md transition-colors"
        aria-label="Operational notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-card animate-pulse" />
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-[22rem] rounded-md border border-border bg-card shadow-lg z-50 animate-in fade-in zoom-in-95 overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-auto py-1 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/50"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 p-2">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
                Loading notifications...
              </div>
            ) : error ? (
              <div className="p-4 text-center text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded">
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-3 opacity-20" />
                <p className="text-sm font-medium">No new notifications</p>
                <p className="text-xs opacity-70 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={(e) =>
                      !notification.is_read &&
                      handleMarkRead(e, notification.id)
                    }
                    className={`p-3 rounded-md border transition-all ${
                      notification.is_read
                        ? "bg-background border-transparent opacity-75"
                        : "bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <div
                          className={`mt-0.5 rounded-full p-1.5 shrink-0 ${
                            notification.is_read
                              ? "bg-muted text-muted-foreground"
                              : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                          }`}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col">
                          <p
                            className={`text-sm leading-tight ${notification.is_read ? "text-foreground/80 font-medium" : "text-foreground font-semibold"}`}
                          >
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-2 opacity-70">
                            <Clock className="h-3 w-3" />
                            <span className="text-[10px]">
                              {formatTime(notification.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleMarkRead(e, notification.id)}
                          className="h-6 w-6 shrink-0 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}