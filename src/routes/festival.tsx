import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/festival")({
  beforeLoad: () => {
    throw redirect({ to: "/eventos" });
  },
});
