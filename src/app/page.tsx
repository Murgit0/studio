import RetroInfoInterface from '@/components/retro-info-interface';

export default function HomePage() {
  return (
    // The main container now uses a flex column layout to manage the sticky header and scrollable content.
    <div className="flex flex-col h-screen">
      {/* The RetroInfoInterface component contains both the header and the results.
          The header will be rendered at the top, and the results section will be scrollable. */}
      <RetroInfoInterface />
    </div>
  );
}
