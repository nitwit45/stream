'use client';

import { useParams } from 'next/navigation';
import { getEpisodeEmbedUrl } from '@/api/vidsrc';
import Link from 'next/link';

export default function EpisodePage() {
  const params = useParams();
  const showId = params.id as string;
  const season = parseInt(params.season as string, 10);
  const episode = parseInt(params.episode as string, 10);
  
  // Generate embed URL
  const embedUrl = getEpisodeEmbedUrl(showId, season, episode);

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold">Season {season}, Episode {episode}</h1>
        <Link 
          href={`/tv/${showId}`}
          className="text-sm px-3 py-1 rounded-md bg-background border hover:bg-secondary"
        >
          Back to Show
        </Link>
      </div>
      
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-8">
        <iframe
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          title={`TV Show ${showId} - S${season}E${episode}`}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Episode Information</h2>
            <p className="text-muted-foreground">
              This content is provided via VidSrc API. Please note that we are just embedding the content and 
              don't host any media files. All rights belong to their respective owners.
            </p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">Episode Navigation</h2>
            <div className="flex flex-wrap gap-2">
              {episode > 1 && (
                <Link 
                  href={`/tv/${showId}/season/${season}/episode/${episode - 1}`}
                  className="px-3 py-1 rounded-md bg-background border hover:bg-secondary"
                >
                  Previous Episode
                </Link>
              )}
              <Link 
                href={`/tv/${showId}/season/${season}/episode/${episode + 1}`}
                className="px-3 py-1 rounded-md bg-background border hover:bg-secondary"
              >
                Next Episode
              </Link>
              {season > 1 && (
                <Link 
                  href={`/tv/${showId}/season/${season - 1}/episode/1`}
                  className="px-3 py-1 rounded-md bg-background border hover:bg-secondary"
                >
                  Previous Season
                </Link>
              )}
              <Link 
                href={`/tv/${showId}/season/${season + 1}/episode/1`}
                className="px-3 py-1 rounded-md bg-background border hover:bg-secondary"
              >
                Next Season
              </Link>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Player Controls</h2>
            <p className="text-sm text-muted-foreground">
              The player supports standard controls:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 mt-2">
              <li>Play/Pause: Click on the video or use the player controls</li>
              <li>Volume: Adjust using the volume slider</li>
              <li>Fullscreen: Click the fullscreen button in the player</li>
              <li>Quality: Some videos may offer quality selection</li>
              <li>Subtitles: If available, can be toggled in the player settings</li>
            </ul>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">Playback Issues?</h2>
            <p className="text-sm text-muted-foreground">
              If you're experiencing playback issues:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 mt-2">
              <li>Check your internet connection</li>
              <li>Try refreshing the page</li>
              <li>Try a different browser or device</li>
              <li>Some episodes may take a moment to load</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 