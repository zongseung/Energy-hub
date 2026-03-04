import { TopBar } from "./components/layout/TopBar";
import { MainLayout } from "./components/layout/MainLayout";
import { StatusBar } from "./components/layout/StatusBar";

export default function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-hb-bg">
      <TopBar />
      <MainLayout />
      <StatusBar />
    </div>
  );
}
