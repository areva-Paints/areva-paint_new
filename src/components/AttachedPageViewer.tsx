import { contentUrl } from '../site-content';
import { useSiteContent } from '../admin/ContentContext';
import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';

interface AttachedPageViewerProps {
  onBackToReact?: () => void;
  className?: string;
}

export const AttachedPageViewer: React.FC<AttachedPageViewerProps> = ({
  onBackToReact,
  className = '',
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const revision = useSiteContent()?.revision;
  const lastRevision = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (revision === undefined) return;
    if (lastRevision.current !== undefined && lastRevision.current !== revision) setRefreshKey(key => key+1);
    lastRevision.current = revision;
  }, [revision]);

  const attachedUrl = contentUrl('/assets/aistudio/areva-paints_a2364c60.html');

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className={`relative w-full h-screen flex flex-col bg-white overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : ''} ${className}`}>
      
      {/* Clean Full-Height Embedded Iframe - Zero status bars pushing content */}
      <iframe
        key={refreshKey}
        ref={iframeRef}
        src={attachedUrl}
        title="Attached Areva Paints HTML Page"
        className="w-full h-full border-0 flex-1"
        allow="camera; microphone; accelerometer; gyroscope; fullscreen"
      />

      {/* Subtle Floating Bottom-Right Action Pill (Zero intrusion) */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 p-1 rounded-full bg-stone-950/80 hover:bg-stone-950 text-white shadow-xl backdrop-blur-md transition-all border border-white/10 opacity-70 hover:opacity-100">
        <button
          onClick={handleRefresh}
          className="p-2 rounded-full hover:bg-white/20 text-stone-300 hover:text-white transition-colors"
          title="Reload page"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-full hover:bg-white/20 text-stone-300 hover:text-white transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        <a
          href={attachedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full hover:bg-white/20 text-amber-400 hover:text-amber-300 transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {onBackToReact && (
          <button
            onClick={onBackToReact}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-xs"
            title="Switch to Modern React Studio"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>React Studio</span>
          </button>
        )}
      </div>

    </div>
  );
};
