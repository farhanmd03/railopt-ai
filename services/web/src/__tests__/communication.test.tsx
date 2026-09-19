import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DepartmentCommunicationChannel } from "@/components/communication/department-communication-channel";
import * as optimizationApi from "@/lib/api/optimization";
import * as reactOidcContext from "react-oidc-context";

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/optimization", () => ({
  getBlockMessages: vi.fn(),
  sendBlockMessage: vi.fn(),
}));

describe("DepartmentCommunicationChannel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "snt-123",
          preferred_username: "snt.demo",
          name: "SNT Officer",
          "https://railopt.ai/roles": ["SNT"],
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);
  });

  it("renders live discussion label and loads block messages", async () => {
    const mockMessages = [
      {
        id: 1,
        optimized_block_id: 101,
        department: "ENGINEERING",
        actor: "Track Engineer",
        message: "Requesting track possession at 08:00.",
        message_type: "DISCUSSION",
        timestamp: "2026-09-20T08:00:00Z",
      },
    ];

    vi.mocked(optimizationApi.getBlockMessages).mockResolvedValue(mockMessages as any);

    render(<DepartmentCommunicationChannel blockId={101} departments={["Engineering", "S&T"]} />);

    expect(screen.getByText(/Inter-Department Communication Channel/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Discussion/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Requesting track possession at 08:00.")).toBeInTheDocument();
      expect(screen.getByText("Track Engineer")).toBeInTheDocument();
    });
  });

  it("allows SNT user to submit an operational discussion message", async () => {
    vi.mocked(optimizationApi.getBlockMessages).mockResolvedValue([]);
    vi.mocked(optimizationApi.sendBlockMessage).mockResolvedValue({
      id: 2,
      optimized_block_id: 101,
      department: "SNT",
      actor: "SNT Officer",
      message: "Signalling circuits ready for window",
      message_type: "DISCUSSION",
      timestamp: "2026-09-20T08:05:00Z",
    } as any);

    render(<DepartmentCommunicationChannel blockId={101} departments={["Engineering", "S&T"]} />);

    const input = screen.getByPlaceholderText(/Type operational discussion message/i);
    fireEvent.change(input, { target: { value: "Signalling circuits ready for window" } });

    const sendButton = screen.getByRole("button", { name: /Send/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(optimizationApi.sendBlockMessage).toHaveBeenCalledWith(101, {
        department: "SNT",
        message: "Signalling circuits ready for window",
      });
      expect(screen.getByText("Signalling circuits ready for window")).toBeInTheDocument();
    });
  });
});
