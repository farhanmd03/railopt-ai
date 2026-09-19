import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationCenter } from "@/components/notifications/notification-center";
import * as reactOidcContext from "react-oidc-context";
import * as notificationApi from "@/lib/api/notifications";

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

const mockNotifications = [
  {
    id: 1,
    user_id: "demo.user",
    notification_type: "APPROVAL_REQUIRED",
    title: "Optimization Run Submitted",
    message: "Run 100 pending approval",
    entity_type: "OptimizationRun",
    entity_id: "100",
    payload: null,
    is_read: false,
    created_at: "2026-09-17T02:00:00Z",
    read_at: null,
  },
  {
    id: 2,
    user_id: "demo.user",
    notification_type: "BLOCK_APPROVED",
    title: "Block Approved",
    message: "Block 201 has been approved.",
    entity_type: "OptimizedBlock",
    entity_id: "201",
    payload: null,
    is_read: true,
    created_at: "2026-09-17T01:00:00Z",
    read_at: "2026-09-17T01:30:00Z",
  },
];

describe("NotificationCenter Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-1",
          preferred_username: "demo.user",
          realm_access: { roles: ["PLANNER"] },
        },
      },
    } as any);

    vi.spyOn(notificationApi, "getNotifications").mockResolvedValue({
      items: mockNotifications,
      total: 2,
      unread_count: 1,
    });

    vi.spyOn(notificationApi, "markNotificationRead").mockResolvedValue({
      ...mockNotifications[0],
      is_read: true,
    });

    vi.spyOn(notificationApi, "markAllNotificationsRead").mockResolvedValue({
      message: "All notifications marked as read.",
    });
  });

  it("renders bell icon and unread indicator when there are unread notifications", async () => {
    render(<NotificationCenter />);

    const bellBtn = screen.getByRole("button", {
      name: /Operational notifications/i,
    });
    expect(bellBtn).toBeInTheDocument();

    await waitFor(() => {
      // Check for the animate-pulse dot indicator instead of explicit text
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  it("opens panel on click and displays notifications", async () => {
    render(<NotificationCenter />);

    const bellBtn = screen.getByRole("button", {
      name: /Operational notifications/i,
    });
    fireEvent.click(bellBtn);

    expect(screen.getByText("Notifications")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Optimization Run Submitted"),
      ).toBeInTheDocument();
      expect(screen.getByText("Block Approved")).toBeInTheDocument();
      expect(screen.getByText("Run 100 pending approval")).toBeInTheDocument();
    });
  });

  it("marks a single notification as read", async () => {
    render(<NotificationCenter />);

    fireEvent.click(
      screen.getByRole("button", { name: /Operational notifications/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Optimization Run Submitted"),
      ).toBeInTheDocument();
    });

    const markReadBtn = screen.getByTitle("Mark as read");
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(notificationApi.markNotificationRead).toHaveBeenCalledWith(1);
    });
  });

  it("marks all notifications as read", async () => {
    render(<NotificationCenter />);

    fireEvent.click(
      screen.getByRole("button", { name: /Operational notifications/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Mark all read")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mark all read"));

    await waitFor(() => {
      expect(notificationApi.markAllNotificationsRead).toHaveBeenCalled();
    });
  });
});
