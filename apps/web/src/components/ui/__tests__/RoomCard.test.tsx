import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { RoomCard } from "../RoomCard";

const baseRoom = {
  id: 42,
  name: "Lobby",
  creator: "Bob",
  players: 1,
  maxPlayers: 4,
};

describe("RoomCard", () => {
  it("shows the name, creator, occupancy and id", () => {
    renderWithProviders(<RoomCard room={baseRoom} onClick={() => {}} />);
    expect(screen.getByText("Lobby")).toBeTruthy();
    expect(screen.getByText(/Bob/)).toBeTruthy();
    expect(screen.getByText("1/4")).toBeTruthy();
    expect(screen.getByText("#42")).toBeTruthy();
  });

  it("fires onClick when the room has room", () => {
    const onClick = vi.fn();
    const { container } = renderWithProviders(
      <RoomCard room={baseRoom} onClick={onClick} />
    );
    fireEvent.click(container.firstChild as Element);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when the room is full", () => {
    const onClick = vi.fn();
    const { container } = renderWithProviders(
      <RoomCard
        room={{ ...baseRoom, players: 4, maxPlayers: 4 }}
        onClick={onClick}
      />
    );
    fireEvent.click(container.firstChild as Element);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText("4/4")).toBeTruthy();
  });

  it("shows lobby/in-game and co-op badges when the server provides them", () => {
    renderWithProviders(
      <RoomCard
        room={{ ...baseRoom, status: "lobby", mode: "coop" }}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("In lobby")).toBeTruthy();
    expect(screen.getByText("Co-op")).toBeTruthy();

    renderWithProviders(
      <RoomCard room={{ ...baseRoom, status: "playing" }} onClick={() => {}} />
    );
    expect(screen.getByText("In game")).toBeTruthy();
  });

  it("renders no badges for an old server that omits status/mode", () => {
    renderWithProviders(<RoomCard room={baseRoom} onClick={() => {}} />);
    expect(screen.queryByText("In lobby")).toBeNull();
    expect(screen.queryByText("In game")).toBeNull();
    expect(screen.queryByText("Co-op")).toBeNull();
  });
});
