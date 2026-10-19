import { Component, type ErrorInfo, type ReactNode } from "react";
import { tr } from "@/i18n/tr";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[kitap-studiosu] ErrorBoundary", error, info);
  }

  override componentDidMount(): void {
    const hot = import.meta.hot;
    if (!hot) return;
    hot.on("vite:afterUpdate", () => {
      if (this.state.hasError) this.setState({ hasError: false });
    });
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#070b14] p-8 text-[#d7e3f4]">
        <div className="max-w-md rounded-lg border border-[#1c2a44] bg-[#0d1524] p-6">
          <h1 className="mb-2 text-lg font-semibold">{tr.errors.boundaryTitle}</h1>
          <p className="mb-4 text-sm text-[#8aa0bd]">{tr.errors.boundaryBody}</p>
          <Button onClick={() => this.setState({ hasError: false })}>{tr.errors.reload}</Button>
        </div>
      </div>
    );
  }
}
