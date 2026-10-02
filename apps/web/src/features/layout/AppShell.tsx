import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export function AppShell() {
  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen">
      <Sidebar />
      <div className="pl-72">
        <Navbar />
        <main className="w-full pt-16 bg-surface min-h-screen px-space-lg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
