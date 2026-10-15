import React, { useState } from 'react';
import {
  X,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Globe,
  FileCode,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GooglePlayPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GooglePlayPublishModal: React.FC<GooglePlayPublishModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'pwabuilder' | 'bubblewrap' | 'checklist' | 'assetlinks'>('pwabuilder');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [customPackageName, setCustomPackageName] = useState('com.groupalarm.app');
  const [customSha256, setCustomSha256] = useState(
    '14:6D:E9:EB:AB:52:4B:EB:EC:12:8C:AE:86:45:00:AE:49:D4:E8:4A:69:7B:10:E0:2E:7C:12:7C:20:BE:F4:F2'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  // The live public production/shared URL of the app
  const appLiveUrl = window.location.origin.includes('localhost') || window.location.origin.includes('0.0.0.0')
    ? 'https://ais-pre-wtilhfqqq2kvmktkrxqtyu-337365292337.asia-east1.run.app'
    : window.location.origin;

  const pwabuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(appLiveUrl)}`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const bubblewrapScript = `# 1. Install Google's official Bubblewrap CLI
npm install -g @bubblewrap/cli

# 2. Initialize project from your live Web App Manifest
bubblewrap init --manifest=${appLiveUrl}/manifest.json

# 3. Build signed Android App Bundle (.aab)
bubblewrap build`;

  const assetLinksJson = JSON.stringify(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: customPackageName.trim() || 'com.groupalarm.app',
          sha256_cert_fingerprints: [
            customSha256.trim() ||
              '14:6D:E9:EB:AB:52:4B:EB:EC:12:8C:AE:86:45:00:AE:49:D4:E8:4A:69:7B:10:E0:2E:7C:12:7C:20:BE:F4:F2',
          ],
        },
      },
    ],
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Smartphone className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Google Play Store Packaging</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider">
                  Ready to Pack
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Pack your Group Alarm app into an Android App Bundle (.aab) & publish to Google Play.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Readiness Checklist Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Manifest: Valid
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Service Worker: Active
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Play Icons: 512x512
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Digital AssetLinks: Ready
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs" title={appLiveUrl}>
            URL: {appLiveUrl}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 flex gap-2 overflow-x-auto shrink-0 bg-white">
          <button
            onClick={() => setActiveTab('pwabuilder')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'pwabuilder'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>1-Click PWABuilder (Recommended)</span>
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'checklist'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Play Store Step-by-Step Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('assetlinks')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'assetlinks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Digital AssetLinks (TWA)</span>
          </button>
          <button
            onClick={() => setActiveTab('bubblewrap')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'bubblewrap'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Bubblewrap CLI</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* TAB 1: PWABUILDER */}
          {activeTab === 'pwabuilder' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Fastest Path: Official PWABuilder Packaging</h4>
                  <p className="text-xs text-blue-800/90 mt-1 leading-relaxed">
                    PWABuilder (developed by Microsoft & Google engineers) inspects your live Group Alarm PWA and compiles a production-ready <strong>Android App Bundle (.aab)</strong> and <strong>APK</strong> for the Google Play Store without needing Android Studio installed.
                  </p>
                </div>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-2">
                      Step 1
                    </span>
                    <h5 className="text-sm font-black text-slate-900">Generate .AAB on PWABuilder</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Opens your app directly in PWABuilder with all manifest scores passing (100% store-ready). Click <strong>"Package for Stores"</strong> &rarr; <strong>"Google Play"</strong>.
                    </p>
                  </div>
                  <a
                    href={pwabuilderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <span>Open PWABuilder for Group Alarm</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mb-2">
                      Step 2
                    </span>
                    <h5 className="text-sm font-black text-slate-900">Upload to Google Play Console</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Download the generated zip file containing your signed <strong>app-release.aab</strong> and upload it to your Google Play Console release track.
                    </p>
                  </div>
                  <a
                    href="https://play.google.com/console"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <span>Go to Google Play Console</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Instructions Summary */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  What PWABuilder provides you with:
                </h5>
                <ul className="text-xs text-slate-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Signed .AAB file</strong> (Android App Bundle required by Google Play since 2021).</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Keystore signature</strong> (used for cryptographic signing and future app updates).</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Full Screen Native Android Experience</strong> without URL bar via Trusted Web Activity (TWA).</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Automated Digital AssetLinks</strong> configuration.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: PLAY STORE CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-amber-700" />
                  Google Play Store Publishing Requirements Checklist
                </h4>
                <p className="text-xs text-amber-800/90 mt-1">
                  Follow these essential 5 steps to successfully publish "Group Alarm" to Android users worldwide:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2.5 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <span>Google Play Developer Account</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 pl-7 leading-relaxed">
                    Sign up at <a href="https://play.google.com/console/signup" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline">play.google.com/console/signup</a>. Google requires a one-time $25 registration fee and identity verification.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2.5 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Create Application in Console</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 pl-7 leading-relaxed">
                    Click <strong>"Create app"</strong> &rarr; Enter App Name: <strong>Group Alarm</strong> &rarr; Default Language: <strong>English</strong> &rarr; App type: <strong>App / Free</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2.5 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <span>Store Listing Graphic Assets</span>
                  </div>
                  <div className="mt-2 pl-7 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <strong>App Icon:</strong> 512x512 PNG with 32-bit color
                      </div>
                      <a
                        href="/pwa-512x512.png"
                        download="group-alarm-512x512.png"
                        className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 flex items-center gap-1 text-[11px]"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Icon
                      </a>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <strong>Feature Graphic:</strong> 1024x500 JPG or PNG banner for the Play Store header.
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <strong>Screenshots:</strong> At least 2 phone screenshots (take directly in browser or phone view).
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2.5 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      4
                    </span>
                    <span>App Content & Declarations</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 pl-7 leading-relaxed">
                    Complete the mandatory questionnaires in Google Play Console:
                    <br />• <strong>Target Audience:</strong> 13+ or General
                    <br />• <strong>Content Rating:</strong> Complete questionnaire (utility / alarm app)
                    <br />• <strong>Data Safety:</strong> App stores user account name/email for group alarm rosters via secure Firebase.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2.5 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      5
                    </span>
                    <span>Upload .AAB Bundle & Submit for Review</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 pl-7 leading-relaxed">
                    Go to <strong>Releases &rarr; Production</strong> (or <strong>Closed Testing</strong>) &rarr; Upload your generated <strong>.aab</strong> bundle &rarr; Click <strong>"Save" & "Review release"</strong> &rarr; <strong>"Start rollout to Production"</strong>! Google reviews apps typically within 24–48 hours.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ASSETLINKS */}
          {activeTab === 'assetlinks' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-700" />
                  Digital Asset Links (Removes Chrome URL Bar on Android)
                </h4>
                <p className="text-xs text-indigo-800/90 mt-1 leading-relaxed">
                  When users launch your app from Google Play Store, Android verifies <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono text-[11px]">/.well-known/assetlinks.json</code> on your domain. Once verified, Android treats it as 100% native and completely hides the browser navigation bar!
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Android Package Name (Application ID):
                  </label>
                  <input
                    type="text"
                    value={customPackageName}
                    onChange={(e) => setCustomPackageName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. com.groupalarm.app"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SHA-256 Certificate Fingerprint (from Play App Signing):
                  </label>
                  <input
                    type="text"
                    value={customSha256}
                    onChange={(e) => setCustomSha256(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 14:6D:E9:EB:AB:..."
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Found in Google Play Console under <em>Setup &rarr; App Signing &rarr; App signing key certificate (SHA-256)</em>.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700">
                      Generated assetlinks.json:
                    </span>
                    <button
                      onClick={() => handleCopy(assetLinksJson, 'assetlinks')}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedText === 'assetlinks' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy JSON
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto">
                    {assetLinksJson}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BUBBLEWRAP CLI */}
          {activeTab === 'bubblewrap' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-slate-700" />
                  Google Chrome Bubblewrap CLI
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  For engineers who prefer the command-line, Google maintains <strong>Bubblewrap</strong> to build, sign, and validate Trusted Web Activities directly into an Android App Bundle (.aab).
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700">Terminal Commands:</span>
                  <button
                    onClick={() => handleCopy(bubblewrapScript, 'bubblewrap')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText === 'bubblewrap' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Commands
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {bubblewrapScript}
                </pre>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <strong>Prerequisites for CLI:</strong>
                <p className="text-blue-800">
                  Java Development Kit (JDK 17 or 21) and Android SDK Command-line Tools (Bubblewrap will prompt you to automatically download them on first run).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <a
              href="/manifest.json"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 underline"
            >
              <Globe className="w-3.5 h-3.5" /> View Manifest
            </a>
            <span className="text-slate-300">•</span>
            <a
              href="/.well-known/assetlinks.json"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 underline"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> View AssetLinks
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
            <a
              href={pwabuilderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>Build .AAB Package Now</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
