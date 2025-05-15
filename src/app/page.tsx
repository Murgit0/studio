import RetroInfoInterface from '@/components/retro-info-interface';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 selection:bg-accent selection:text-accent-foreground">
      <RetroInfoInterface />
    </main>
  );
}
