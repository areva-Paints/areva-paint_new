import React, { useState } from 'react';
import {
  Download,
  X,
  FileCode,
  FolderArchive,
  Terminal,
  Check,
  Copy,
  Layers,
  Server,
  Code2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Zap,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import JSZip from 'jszip';

interface ProjectDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectDownloadModal: React.FC<ProjectDownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'windows-fix' | 'github'>('overview');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  
  // Client-side in-browser generation states
  const [isGeneratingClientZip, setIsGeneratingClientZip] = useState(false);
  const [clientZipProgress, setClientZipProgress] = useState<string>('');
  const [clientZipDone, setClientZipDone] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2500);
  };

  // Generate ZIP in-browser using JSZip to completely eliminate iframe proxy cutoffs
  const handleGenerateInBrowser = async () => {
    setIsGeneratingClientZip(true);
    setClientZipDone(false);
    setClientZipProgress('Fetching latest project source files...');
    try {
      const res = await fetch('/api/project/source-files');
      if (!res.ok) throw new Error('Unable to fetch source code manifest from server.');
      const data = await res.json();
      
      setClientZipProgress(`Packing ${data.count} project files with MS-DOS FAT headers...`);
      const zip = new JSZip();

      for (const [filePath, content] of Object.entries(data.files)) {
        zip.file(filePath, content as string, {
          date: new Date('2026-01-01T00:00:00Z'),
          createFolders: true,
        });
      }

      setClientZipProgress('Compressing archive (DEFLATE level 9)...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        platform: 'DOS',
      });

      setClientZipProgress('Triggering direct browser download...');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'areva-paints-fullstack.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      setClientZipDone(true);
      setClientZipProgress('ZIP archive generated and downloaded successfully!');
      setTimeout(() => setClientZipDone(false), 5000);
    } catch (err) {
      console.error('In-browser zip generation error:', err);
      setClientZipProgress('Failed to generate ZIP: ' + (err as Error).message);
    } finally {
      setIsGeneratingClientZip(false);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullZipUrl = `${currentOrigin}/areva-paints-fullstack.zip`;
  const codeZipUrl = `${currentOrigin}/areva-paints-code.zip`;

  const powerShellCommand = `$url = "${fullZipUrl}"; $destZip = "$HOME\\Downloads\\areva-paints-fullstack.zip"; $extractDir = "$HOME\\Downloads\\areva-paints-fullstack"; Invoke-WebRequest -Uri $url -OutFile $destZip; Expand-Archive -Path $destZip -DestinationPath $extractDir -Force; explorer $extractDir`;

  const windowsTarCommand = `tar -xf areva-paints-fullstack.zip`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 sm:px-8 py-5 border-b border-stone-800 bg-stone-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-extrabold text-xl text-white tracking-tight">
                  Download Project Source Code
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Windows Explorer Verified
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Full-Stack React 19 + TypeScript + Node.js/Express + WebXR AR Studio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors focus:outline-none"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 bg-stone-100/70 px-4 sm:px-8 pt-2.5 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-700 text-amber-950 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            📦 Download Archives
          </button>
          <button
            onClick={() => setActiveTab('windows-fix')}
            className={`pb-2.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'windows-fix'
                ? 'border-blue-700 text-blue-950 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>⊞ Windows 10/11 Extraction Guide</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
              Fix Invalid Folder
            </span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`pb-2.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'github'
                ? 'border-stone-900 text-stone-950 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>🐙 Push to GitHub</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-stone-900">
          {activeTab === 'overview' && (
            <>
              {/* Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3 text-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Windows MS-DOS Compatibility Applied:</span> All archives below are formatted with standard FAT/MS-DOS 32-bit directory records and parent-first ordering, ensuring Windows 10 & 11 File Explorer unzips cleanly without &ldquo;invalid folder&rdquo; errors.
                </div>
              </div>

              {/* Package 1: Full Production ZIP */}
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50 border border-amber-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Option 1 (Complete)
                    </span>
                    <span className="text-[10px] bg-stone-200 text-stone-800 px-2 py-0.5 rounded-md font-mono font-bold">
                      3.8 MB
                    </span>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-display font-black text-stone-950">
                    areva-paints-fullstack.zip
                  </h4>
                  <p className="text-xs sm:text-sm text-stone-600 max-w-md">
                    Complete source code, Express backend, React components, and high-definition architectural demonstration images.
                  </p>
                </div>

                <div className="shrink-0 w-full sm:w-auto flex flex-col items-center gap-2">
                  <a
                    href="/areva-paints-fullstack.zip"
                    download="areva-paints-fullstack.zip"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-stone-950 hover:bg-amber-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer text-center no-underline"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Download Full Project (3.8 MB)</span>
                  </a>

                  <a
                    href="/areva-paints-fullstack.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-700 hover:text-amber-900 underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Open in new tab (bypasses iframe)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Package 2: Ultra-Fast Lightweight Code-Only Archive */}
              <div className="relative p-6 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-blue-600" />
                      Option 2 (Instant & Ultra-Reliable)
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-mono font-bold">
                      ~110 KB
                    </span>
                  </div>
                  <h4 className="text-lg sm:text-xl font-display font-bold text-stone-950">
                    areva-paints-code.zip
                  </h4>
                  <p className="text-xs text-stone-600 max-w-md">
                    100% complete TypeScript logic, components, Express backend, configuration, and styles (excludes heavy demo JPGs). Downloads instantly in under 1 second with <strong>zero risk of network cutoff</strong>.
                  </p>
                </div>

                <div className="shrink-0 w-full sm:w-auto flex flex-col items-center gap-2">
                  <a
                    href="/areva-paints-code.zip"
                    download="areva-paints-code.zip"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-sm hover:shadow transition-all duration-200 active:scale-95 cursor-pointer text-center no-underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Clean Code (~110 KB)</span>
                  </a>

                  <a
                    href="/areva-paints-code.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-500 hover:text-stone-800 underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Direct tab download</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Package 3: In-Browser Client JSZip Generator */}
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2 text-stone-900 text-sm">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span>Option 3: Generate ZIP Inside Your Browser (Zero Network Stream Dropout)</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                    Client-Side Engine
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  If your browser or network has trouble streaming large zip files inside the preview iframe, this option bundles all project source files directly into your browser&rsquo;s RAM using <strong>JSZip</strong> and initiates a local blob download.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <button
                    onClick={handleGenerateInBrowser}
                    disabled={isGeneratingClientZip}
                    className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {isGeneratingClientZip ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Generating ZIP...</span>
                      </>
                    ) : clientZipDone ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Downloaded to Your PC!</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Generate &amp; Download In-Browser Now</span>
                      </>
                    )}
                  </button>

                  {clientZipProgress && (
                    <span className="text-xs font-mono text-stone-600 bg-white px-3 py-1.5 rounded-lg border border-amber-200 truncate">
                      {clientZipProgress}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Terminal Setup Instructions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-stone-700" />
                    Quick Run Instructions Once Extracted
                  </h4>
                  <span className="text-xs text-stone-500 font-mono">Node.js 18+ required</span>
                </div>

                <div className="bg-stone-950 text-stone-100 rounded-2xl p-4 sm:p-5 font-mono text-xs space-y-3 border border-stone-800 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                    <span className="text-stone-400 text-[11px]"># 1. Install dependencies</span>
                    <button
                      onClick={() => copyToClipboard('npm install', 'c1')}
                      className="text-stone-400 hover:text-white transition-colors p-1 cursor-pointer"
                      title="Copy command"
                    >
                      {copiedCommand === 'c1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-emerald-400 font-semibold selection:bg-stone-700">npm install</div>

                  <div className="flex items-center justify-between pt-2 pb-2 border-b border-stone-800">
                    <span className="text-stone-400 text-[11px]"># 2. Run full-stack dev server</span>
                    <button
                      onClick={() => copyToClipboard('npm run dev', 'c2')}
                      className="text-stone-400 hover:text-white transition-colors p-1 cursor-pointer"
                      title="Copy command"
                    >
                      {copiedCommand === 'c2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-amber-300 font-semibold selection:bg-stone-700">npm run dev</div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'windows-fix' && (
            <div className="space-y-6">
              {/* Problem Explanation */}
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-stone-900 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Why Did Windows Report &ldquo;The Compressed (zipped) Folder is invalid&rdquo;?</span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed">
                  In Windows 10 and 11, the built-in File Explorer unzipper (<code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">zipfldr.dll</code>) throws this error if:
                </p>
                <ul className="text-xs text-stone-700 space-y-1 list-disc list-inside pl-2">
                  <li><strong>Incomplete Download:</strong> The browser in the preview iframe stopped the download halfway, resulting in a corrupted partial file on your disk.</li>
                  <li><strong>Unix Header Conflict:</strong> Standard Linux archives often omit MS-DOS FAT 32-bit folder attributes.</li>
                </ul>
                <p className="text-xs text-emerald-800 font-semibold mt-1">
                  ✓ We have completely regenerated the ZIP archives with explicit MS-DOS attributes, proper parent-first folder ordering, and added a 1-click PowerShell unzipper below.
                </p>
              </div>

              {/* Solution 1: PowerShell 1-Click Command */}
              <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-stone-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2 text-blue-950 text-sm">
                    <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">1</span>
                    <span>Method 1 (Guaranteed): 1-Click PowerShell Download &amp; Extract</span>
                  </div>
                  <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded">
                    Bypasses Browser
                  </span>
                </div>
                <p className="text-xs text-stone-600">
                  Press <kbd className="bg-stone-200 px-1.5 py-0.5 rounded text-[11px] font-mono">Win + X</kbd> and choose <strong>Terminal</strong> or <strong>PowerShell</strong>, then paste this command:
                </p>

                <div className="bg-stone-950 text-stone-100 p-3.5 rounded-xl font-mono text-[11px] space-y-2 border border-stone-800">
                  <div className="flex items-center justify-between pb-1 border-b border-stone-800 text-stone-400">
                    <span>PowerShell (Downloads directly &amp; extracts to your Downloads folder):</span>
                    <button
                      onClick={() => copyToClipboard(powerShellCommand, 'ps-full')}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-sans font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedCommand === 'ps-full' ? (
                        <>
                          <Check className="w-3 h-3 text-white" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy PowerShell Command</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sky-300 break-all leading-relaxed">
                    {powerShellCommand}
                  </p>
                </div>
              </div>

              {/* Solution 2: Windows Native tar.exe Command */}
              <div className="p-5 rounded-2xl bg-white border border-stone-200 text-stone-900 space-y-3">
                <div className="font-bold flex items-center gap-2 text-stone-950 text-sm">
                  <span className="w-6 h-6 rounded-lg bg-stone-800 text-white flex items-center justify-center text-xs font-black shadow-xs">2</span>
                  <span>Method 2: Built-in Windows Command Prompt (tar.exe)</span>
                </div>
                <p className="text-xs text-stone-600">
                  Every Windows 10 and 11 PC has a built-in unzipper (<code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-800">tar.exe</code>) in System32 that extracts any zip instantly without File Explorer bugs:
                </p>
                <div className="bg-stone-950 text-stone-100 p-3 rounded-xl font-mono text-xs flex items-center justify-between border border-stone-800">
                  <span className="text-emerald-400">{windowsTarCommand}</span>
                  <button
                    onClick={() => copyToClipboard(windowsTarCommand, 'tar-cmd')}
                    className="text-stone-400 hover:text-white p-1 cursor-pointer"
                    title="Copy tar command"
                  >
                    {copiedCommand === 'tar-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Solution 3: Direct Browser Download in New Tab */}
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 space-y-3">
                <div className="font-bold flex items-center gap-2 text-stone-950 text-sm">
                  <span className="w-6 h-6 rounded-lg bg-amber-700 text-white flex items-center justify-center text-xs font-black shadow-xs">3</span>
                  <span>Method 3: Direct Download in a New Browser Tab</span>
                </div>
                <p className="text-xs text-stone-600">
                  Click the button below to trigger the download in a dedicated browser tab (ensuring no iframe security sandboxes interrupt the transfer):
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="/areva-paints-fullstack.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Full ZIP in New Tab (3.8 MB)</span>
                  </a>
                  <a
                    href="/areva-paints-code.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Code ZIP in New Tab (~110 KB)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-stone-700">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="font-display font-bold text-lg text-white flex items-center gap-2 justify-center sm:justify-start">
                    <span>How to Push to your GitHub Repository</span>
                  </h4>
                  <p className="text-xs text-stone-300">
                    Follow these 4 simple steps to push this full codebase to your personal or organization GitHub repo.
                  </p>
                </div>
                <a
                  href="/areva-paints-fullstack.zip"
                  download="areva-paints-fullstack.zip"
                  className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer no-underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP First</span>
                </a>
              </div>

              {/* Step 1 */}
              <div className="border border-stone-200 rounded-2xl p-5 bg-white space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-800 text-white text-xs flex items-center justify-center font-bold">1</span>
                  <span>Create a New Repository on GitHub</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed pl-8">
                  Go to <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-amber-700 underline font-semibold inline-flex items-center gap-1">github.com/new <ExternalLink className="w-3 h-3" /></a>, enter a repository name (e.g., <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800 font-mono">areva-paints</code>), leave &ldquo;Initialize with README&rdquo; unchecked, and click <strong>Create repository</strong>.
                </p>
              </div>

              {/* Step 2 */}
              <div className="border border-stone-200 rounded-2xl p-5 bg-white space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-800 text-white text-xs flex items-center justify-center font-bold">2</span>
                  <span>Extract the ZIP and Open Terminal in the Extracted Folder</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed pl-8">
                  Extract the downloaded zip, open Command Prompt or PowerShell inside the extracted folder:
                </p>
                <div className="pl-8">
                  <div className="bg-stone-950 text-stone-100 p-3 rounded-xl font-mono text-xs flex items-center justify-between border border-stone-800">
                    <span className="text-emerald-400">cd areva-paints-fullstack</span>
                    <button
                      onClick={() => copyToClipboard('cd areva-paints-fullstack', 'gh-cd')}
                      className="text-stone-400 hover:text-white p-1 cursor-pointer"
                    >
                      {copiedCommand === 'gh-cd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="border border-stone-200 rounded-2xl p-5 bg-white space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-800 text-white text-xs flex items-center justify-center font-bold">3</span>
                  <span>Initialize Git and Commit the Files</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed pl-8">
                  Run the following commands to initialize git and stage all project files:
                </p>
                <div className="pl-8 space-y-2">
                  <div className="bg-stone-950 text-stone-100 p-3.5 rounded-xl font-mono text-xs space-y-2 border border-stone-800">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400">git init</span>
                      <button onClick={() => copyToClipboard('git init', 'g-init')} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                        {copiedCommand === 'g-init' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400">git add .</span>
                      <button onClick={() => copyToClipboard('git add .', 'g-add')} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                        {copiedCommand === 'g-add' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-amber-300">git commit -m &quot;feat: initial commit of Areva Paints fullstack application&quot;</span>
                      <button onClick={() => copyToClipboard('git commit -m "feat: initial commit of Areva Paints fullstack application"', 'g-commit')} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                        {copiedCommand === 'g-commit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sky-300">git branch -M main</span>
                      <button onClick={() => copyToClipboard('git branch -M main', 'g-branch')} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                        {copiedCommand === 'g-branch' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="border border-stone-200 rounded-2xl p-5 bg-white space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-800 text-white text-xs flex items-center justify-center font-bold">4</span>
                  <span>Link Remote and Push to GitHub</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed pl-8">
                  Replace <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">&lt;YOUR-USERNAME&gt;</code> and <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">&lt;YOUR-REPO-NAME&gt;</code> with your GitHub details:
                </p>
                <div className="pl-8 space-y-2">
                  <div className="bg-stone-950 text-stone-100 p-3.5 rounded-xl font-mono text-xs space-y-2 border border-stone-800">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-300">git remote add origin https://github.com/&lt;YOUR-USERNAME&gt;/&lt;YOUR-REPO-NAME&gt;.git</span>
                      <button onClick={() => copyToClipboard('git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git', 'g-remote')} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                        {copiedCommand === 'g-remote' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold">git push -u origin main</span>
                      <button onClick={() => copyToClipboard('git push -u origin main', 'g-push')} className="text-stone-400 hover:text-white p-1 cursor-pointer">
                        {copiedCommand === 'g-push' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pl-8">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Your full codebase is now on GitHub! Team members can clone it and run <code className="font-mono font-bold">npm install &amp;&amp; npm run dev</code>.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 sm:px-8 py-4 bg-stone-100 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>All downloads generated with MS-DOS Windows Explorer compatibility.</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-stone-200 transition-colors font-medium cursor-pointer"
            >
              Close
            </button>
            <a
              href="/areva-paints-fullstack.zip"
              download="areva-paints-fullstack.zip"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold shadow-xs active:scale-95 transition-all text-center no-underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP (3.8 MB)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
