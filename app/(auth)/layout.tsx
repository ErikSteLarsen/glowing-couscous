import { BrandMark } from '@/components/BrandMark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="flex items-center gap-2.5 px-6 pt-6">
        <BrandMark />
        <span className="text-[15px] font-semibold text-[var(--text)]">Tempo</span>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
