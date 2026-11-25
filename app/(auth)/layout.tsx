import { AuthHeaderDownloadLink } from '@/components/AuthHeaderDownloadLink';
import { BrandMark, BrandName } from '@/components/BrandMark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="flex items-center gap-2.5 px-6 pt-6">
        <BrandMark />
        <BrandName />
        <span className="ml-auto"><AuthHeaderDownloadLink /></span>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
