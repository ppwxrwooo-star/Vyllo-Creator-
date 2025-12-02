import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Button } from './components/Button';
import { GeneratedSticker, StickerStyle, ChatMessage, DesignType } from './types';
import { generateStickerImages, refinePrompt, generateMockup } from './services/geminiService';
import { Download, Search, X, MoreHorizontal, ArrowUpRight, Plus, Loader2, Send, Shirt, Sticker, Camera, User, ShoppingBag, Smile, HardHat, Image as ImageIcon, Upload } from 'lucide-react';

// Preset options for Virtual Try-On
const MOCKUP_PRESETS = [
    { id: 'f-tee', label: 'Woman Tee', prompt: 'A trendy female model wearing a white streetwear t-shirt', icon: <User size={16}/> },
    { id: 'm-tee', label: 'Man Tee', prompt: 'A stylish male model wearing a white regular fit t-shirt', icon: <User size={16}/> },
    { id: 'hoodie', label: 'Hoodie', prompt: 'A model wearing a beige oversized hoodie, street style', icon: <Shirt size={16}/> },
    { id: 'tote', label: 'Tote Bag', prompt: 'A canvas tote bag hanging on a wooden chair, natural lighting', icon: <ShoppingBag size={16}/> },
    { id: 'baby', label: 'Baby Onesie', prompt: 'A cute baby wearing a white onesie, soft lighting', icon: <Smile size={16}/> },
    { id: 'cap', label: 'Cap', prompt: 'A baseball cap placed on a modern desk', icon: <HardHat size={16}/> },
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<StickerStyle>(StickerStyle.KAWAII);
  const [designType, setDesignType] = useState<DesignType>(DesignType.STICKER);
  
  // -- Reference Image State (for Generation) --
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Custom Model State (for Mockup) --
  const modelInputRef = useRef<HTMLInputElement>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<GeneratedSticker[]>([]);
  
  // -- Selection & Modification State --
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [currentContextPrompt, setCurrentContextPrompt] = useState<string>('');
  
  // -- Mockup State --
  const [isMockupLoading, setIsMockupLoading] = useState(false);
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [currentMockupPrompt, setCurrentMockupPrompt] = useState<string>(''); // Track the prompt for the model
  const [viewMode, setViewMode] = useState<'design' | 'mockup'>('design');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem('vyllo-history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history
  useEffect(() => {
    localStorage.setItem('vyllo-history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCustomModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Immediately try on the uploaded model
        handleTryOn("Custom uploaded model", result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Reduced default count from 2 to 1 to reduce Rate Limit errors
      const base64Images = await generateStickerImages(prompt, style, 1, designType, referenceImage);
      
      const newStickers = base64Images.map(img => ({
        id: crypto.randomUUID(),
        prompt,
        style,
        type: designType,
        imageUrl: img,
        createdAt: Date.now(),
      }));

      setHistory(prev => [...newStickers, ...prev]);
      
      // Clear reference image after successful generation
      setReferenceImage(null);
      
      // Open the first one by default so user sees result immediately
      openStickerModal(newStickers[0]);

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  const openStickerModal = (sticker: GeneratedSticker) => {
    setSelectedStickerId(sticker.id);
    setActivePreviewUrl(sticker.imageUrl);
    setCurrentContextPrompt(sticker.prompt);
    
    // Reset mockup state
    setViewMode('design');
    setMockupUrl(null);
    setCurrentMockupPrompt(''); 
    
    // Initialize chat
    setChatMessages([
      {
        id: 'init',
        role: 'assistant',
        text: `Here is your ${sticker.type === DesignType.FASHION ? 'fashion print' : 'sticker'} design for "${sticker.prompt}"! \nStyle: ${sticker.style}. \n\nNeed any changes?`,
        attachmentUrl: sticker.imageUrl,
        relatedPrompt: sticker.prompt
      }
    ]);
  };

  const closeStickerModal = () => {
    setSelectedStickerId(null);
    setActivePreviewUrl(null);
    setChatMessages([]);
    setMockupUrl(null);
  };

  const saveMockupToHistory = (url: string, description: string) => {
    const activeSticker = history.find(s => s.id === selectedStickerId);
    if (!activeSticker) return;

    const newMockup: GeneratedSticker = {
        id: crypto.randomUUID(),
        prompt: description,
        style: activeSticker.style,
        type: DesignType.MOCKUP,
        imageUrl: url,
        createdAt: Date.now()
    };
    
    setHistory(prev => [newMockup, ...prev]);
  };

  const handleTryOn = async (modelPrompt: string, customModelData?: string) => {
    if (!activePreviewUrl) return;
    
    setIsMockupLoading(true);
    setViewMode('mockup'); // Switch view immediately to show loader
    setCurrentMockupPrompt(modelPrompt); // Set context for potential chat refinement
    setMockupUrl(null);

    try {
        const resultUrl = await generateMockup(activePreviewUrl, modelPrompt, customModelData);
        setMockupUrl(resultUrl);
        saveMockupToHistory(resultUrl, modelPrompt);
        
        // Add to chat as well
        setChatMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `Here is a preview: ${modelPrompt}. \n\nYou can chat with me to change the model (e.g., "Change to a black hoodie").`,
            attachmentUrl: resultUrl
        }]);

    } catch (err) {
        console.error(err);
        setChatMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: "Sorry, I couldn't generate the mockup. Please try again."
        }]);
        setViewMode('design');
    } finally {
        setIsMockupLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedStickerId) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: chatInput,
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatProcessing(true);

    try {
      if (viewMode === 'mockup' && currentMockupPrompt) {
          // --- MOCKUP EDITING MODE ---
          // User is likely asking to change the model/clothing
          const newMockupPrompt = await refinePrompt(currentMockupPrompt, userMsg.text);
          setCurrentMockupPrompt(newMockupPrompt);
          
          if (!activePreviewUrl) throw new Error("No base design found");
          
          const newMockupUrl = await generateMockup(activePreviewUrl, newMockupPrompt);
          setMockupUrl(newMockupUrl);
          saveMockupToHistory(newMockupUrl, newMockupPrompt);

          const aiMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `Updated model: ${newMockupPrompt}`,
            attachmentUrl: newMockupUrl,
          };
          setChatMessages(prev => [...prev, aiMsg]);

      } else {
          // --- DESIGN EDITING MODE ---
          // User is modifying the sticker/print design
          const newPrompt = await refinePrompt(currentContextPrompt, userMsg.text);
          setCurrentContextPrompt(newPrompt);
    
          const currentItem = history.find(s => s.id === selectedStickerId);
          const styleToUse = currentItem?.style || StickerStyle.KAWAII;
          const typeToUse = currentItem?.type || DesignType.STICKER;
    
          // Use reference image for modification if available in session? 
          // For now we don't carry over the reference image for modifications to keep it simple, 
          // as user might want to drift away from it.
          const base64Images = await generateStickerImages(newPrompt, styleToUse, 1, typeToUse);
          const newImageUrl = base64Images[0];
          
          const aiMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `Here is the updated version.`,
            attachmentUrl: newImageUrl,
            relatedPrompt: newPrompt
          };
    
          setChatMessages(prev => [...prev, aiMsg]);
          setActivePreviewUrl(newImageUrl);
          setViewMode('design'); // Ensure we are looking at the design
      }

    } catch (err) {
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: "Sorry, I couldn't process that change. Please try again."
      }]);
    } finally {
      setIsChatProcessing(false);
    }
  };

  const handleDownload = (imageUrl: string, id: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `vyllo-${id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const activeStickerData = history.find(s => s.id === selectedStickerId);

  return (
    <div className="min-h-screen w-full bg-white text-vyllo-primary pt-20 pb-20">
      <Header />

      {/* Hidden File Input for Reference Image */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
        accept="image/png, image/jpeg, image/jpg"
      />

       {/* Hidden File Input for Custom Model */}
       <input 
        type="file" 
        ref={modelInputRef}
        onChange={handleCustomModelUpload}
        className="hidden"
        accept="image/png, image/jpeg, image/jpg"
      />

      {/* Hero / Create Section */}
      <div className="max-w-4xl mx-auto px-4 mt-8 mb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold mb-8 tracking-tight">
          What will you <span className="text-vyllo-red">create</span> today?
        </h1>
        
        {/* Mode Toggles */}
        <div className="flex justify-center gap-4 mb-6">
            <button 
                onClick={() => setDesignType(DesignType.STICKER)}
                className={`flex items-center gap-2 px-6 py-3 rounded-pill transition-all font-semibold ${designType === DesignType.STICKER ? 'bg-black text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
                <Sticker size={18} />
                Sticker
            </button>
            <button 
                onClick={() => setDesignType(DesignType.FASHION)}
                className={`flex items-center gap-2 px-6 py-3 rounded-pill transition-all font-semibold ${designType === DesignType.FASHION ? 'bg-black text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
                <Shirt size={18} />
                Fashion Print
            </button>
        </div>

        <div className="bg-gray-100 rounded-pill p-2 flex items-center shadow-inner max-w-2xl mx-auto focus-within:ring-4 focus-within:ring-blue-100 transition-shadow">
          {/* Left Icon Area: Image Upload or Search Icon */}
          <div className="pl-3 pr-2 flex items-center">
             {referenceImage ? (
                <div className="relative group w-10 h-10">
                    <img src={referenceImage} alt="Ref" className="w-10 h-10 rounded-lg object-cover border border-gray-300" />
                    <button 
                      onClick={clearReferenceImage}
                      className="absolute -top-2 -right-2 bg-black text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={12} />
                    </button>
                </div>
             ) : (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                  title="Upload Reference Image"
                >
                    <ImageIcon size={24} />
                </button>
             )}
          </div>
          
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder={
                referenceImage 
                ? "Describe how to change this image (e.g., 'Make it cyber style')" 
                : (designType === DesignType.STICKER ? "E.g., 'Retro robot eating pizza'" : "E.g., 'Abstract streetwear skull graphic'")
            }
            className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-lg font-medium placeholder-gray-400 text-vyllo-primary"
            disabled={isGenerating}
          />
          <Button 
            variant="red" 
            size="lg" 
            onClick={handleGenerate} 
            isLoading={isGenerating}
            disabled={!prompt.trim()}
          >
            Create
          </Button>
        </div>

        {/* Style Chips */}
        <div className="flex flex-wrap justify-center gap-3 mt-6 max-w-3xl mx-auto">
           {Object.values(StickerStyle).map((s) => (
             <button
               key={s}
               onClick={() => setStyle(s)}
               className={`
                 px-4 py-2 rounded-pill text-xs font-bold transition-all uppercase tracking-wide
                 ${style === s 
                   ? 'bg-vyllo-primary text-white shadow-lg scale-105' 
                   : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
               `}
             >
               {s.split(' / ')[0]}
             </button>
           ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm inline-block">
            {error}
          </div>
        )}
      </div>

      {/* Masonry Grid Feed */}
      <div className="px-4 md:px-8 max-w-[1600px] mx-auto">
        <h3 className="font-semibold text-lg mb-4 text-gray-500">Recent Creations</h3>
        <div className="masonry-grid">
          {history.map((sticker) => (
            <div 
              key={sticker.id} 
              onClick={() => openStickerModal(sticker)}
              className="masonry-item relative group rounded-2xl overflow-hidden bg-gray-50 cursor-zoom-in border border-transparent hover:border-gray-200 transition-colors"
            >
              <img 
                src={sticker.imageUrl} 
                alt={sticker.prompt} 
                className="w-full h-auto object-cover"
              />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded-md opacity-60 uppercase font-bold tracking-wide">
                {sticker.type === DesignType.FASHION ? 'PRINT' : sticker.type === DesignType.MOCKUP ? 'TRY-ON' : 'STICKER'}
              </div>
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-4">
                 <div className="flex justify-end">
                    <button 
                        className="bg-vyllo-red text-white px-4 py-2 rounded-pill font-bold text-sm shadow-md hover:scale-105 transition-transform"
                        onClick={(e) => {
                            e.stopPropagation();
                            openStickerModal(sticker);
                        }}
                    >
                        View
                    </button>
                 </div>
              </div>
            </div>
          ))}
        </div>
        
        {history.length === 0 && !isGenerating && (
          <div className="text-center text-gray-400 py-20">
            <p className="mb-4">No creations yet.</p>
            <div className="w-16 h-1 bg-gray-200 mx-auto rounded-full"></div>
          </div>
        )}
      </div>

      {/* Workspace Modal */}
      {selectedStickerId && activeStickerData && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={closeStickerModal}>
          <div 
            className="bg-white rounded-[24px] w-full max-w-6xl h-[85vh] mx-auto overflow-hidden shadow-2xl flex relative animate-in fade-in zoom-in-95 duration-200 flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
             <button 
               onClick={closeStickerModal}
               className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full z-10 md:hidden"
             >
               <X size={24} />
             </button>

             {/* LEFT: Canvas / Preview Area */}
             <div className="w-full md:w-2/3 bg-[#F0F2F5] flex flex-col relative">
                {/* Status Bar */}
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                   <div className="bg-white/80 backdrop-blur rounded-pill px-4 py-2 text-sm font-semibold shadow-sm text-gray-700 flex items-center gap-2">
                     {activeStickerData.type === DesignType.FASHION ? <Shirt size={14}/> : <Sticker size={14}/>}
                     {activeStickerData.type === DesignType.FASHION ? 'Fashion Print' : activeStickerData.type === DesignType.MOCKUP ? 'Virtual Try-On' : 'Sticker'}
                   </div>
                   <div className="bg-white/80 backdrop-blur rounded-pill px-4 py-2 text-sm font-semibold shadow-sm text-gray-700">
                     {activeStickerData.style}
                   </div>
                </div>
                
                {/* View Toggles (Design vs Mockup) */}
                {/* Only show toggles if it's NOT a finalized mockup (mockups are just static images) */}
                {activeStickerData.type !== DesignType.MOCKUP && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex bg-white rounded-full shadow-lg p-1">
                    <button 
                        onClick={() => setViewMode('design')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${viewMode === 'design' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        Design
                    </button>
                    <button 
                        onClick={() => {
                            if (mockupUrl) {
                                setViewMode('mockup');
                            } else {
                                // Default to Woman Tee if no mockup generated yet
                                handleTryOn(MOCKUP_PRESETS[0].prompt);
                            }
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${viewMode === 'mockup' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        Try On
                    </button>
                    </div>
                )}

                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <Button variant="ghost" onClick={() => setActivePreviewUrl(activeStickerData.imageUrl)} className="bg-white/80 backdrop-blur shadow-sm hidden md:flex">
                        Reset
                    </Button>
                    <Button variant="red" onClick={() => (viewMode === 'mockup' && mockupUrl) ? handleDownload(mockupUrl, 'mockup') : (activePreviewUrl && handleDownload(activePreviewUrl, selectedStickerId))}>
                        Download {viewMode === 'mockup' ? 'Mockup' : 'PNG'}
                    </Button>
                </div>

                {/* Preview Image Area */}
                <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
                    {/* Design View */}
                    {viewMode === 'design' && activePreviewUrl && (
                        <img 
                         src={activePreviewUrl} 
                         alt="Current Design" 
                         className="max-w-full max-h-full object-contain drop-shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95"
                       />
                    )}

                    {/* Mockup View */}
                    {viewMode === 'mockup' && (
                        <>
                           {isMockupLoading ? (
                               <div className="flex flex-col items-center gap-4 text-gray-500 animate-in fade-in">
                                   <Loader2 className="animate-spin" size={48} />
                                   <p className="font-medium">Generating virtual try-on...</p>
                               </div>
                           ) : mockupUrl ? (
                               <img 
                                src={mockupUrl} 
                                alt="Virtual Try On" 
                                className="max-w-full max-h-full object-contain drop-shadow-xl animate-in fade-in zoom-in-95"
                               />
                           ) : (
                               <div className="text-center text-gray-400">
                                   Select a model below to generate
                               </div>
                           )}
                        </>
                    )}
                </div>
             </div>

             {/* RIGHT: Chat / Iteration / Tools Interface */}
             <div className="w-full md:w-1/3 bg-white flex flex-col border-l border-gray-100">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-bold text-lg">Design Assistant</h2>
                    <button onClick={closeStickerModal} className="hidden md:block p-2 hover:bg-gray-100 rounded-full text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Try On Controls - Only if not already a Mockup */}
                {activeStickerData.type !== DesignType.MOCKUP && (
                    <div className="px-4 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Virtual Try-On</h3>
                        <div className="grid grid-cols-3 gap-2">
                             <button 
                                onClick={() => modelInputRef.current?.click()}
                                disabled={isMockupLoading}
                                className={`
                                    bg-white border border-dashed border-gray-300 text-gray-500 hover:border-black hover:text-black p-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1.5
                                `}
                            >
                                <Camera size={16}/>
                                <span>Upload Photo</span>
                            </button>
                            {MOCKUP_PRESETS.map((preset) => (
                                <button 
                                    key={preset.id}
                                    onClick={() => handleTryOn(preset.prompt)}
                                    disabled={isMockupLoading}
                                    className={`
                                        bg-white border p-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1.5
                                        ${currentMockupPrompt === preset.prompt ? 'border-black bg-gray-50 text-black' : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-black'}
                                    `}
                                >
                                    {preset.icon}
                                    <span>{preset.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white" ref={chatScrollRef}>
                    {chatMessages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`
                                max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                                ${msg.role === 'user' 
                                    ? 'bg-vyllo-primary text-white rounded-br-none' 
                                    : 'bg-gray-100 text-gray-800 rounded-bl-none'}
                            `}>
                                {msg.text}
                            </div>
                            {msg.attachmentUrl && (
                                <div 
                                    className="mt-2 w-32 h-32 rounded-xl overflow-hidden border-2 border-transparent hover:border-vyllo-red cursor-pointer transition-all shadow-sm"
                                    onClick={() => {
                                        if (msg.text.includes("Updated model") || msg.text.includes("preview")) {
                                            setMockupUrl(msg.attachmentUrl || null);
                                            setViewMode('mockup');
                                        } else {
                                            setActivePreviewUrl(msg.attachmentUrl || null);
                                            setViewMode('design');
                                        }
                                    }}
                                >
                                    <img src={msg.attachmentUrl} className="w-full h-full object-cover bg-gray-50" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isChatProcessing && (
                        <div className="flex items-start">
                             <div className="bg-gray-100 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin text-gray-500" />
                                <span className="text-xs text-gray-500 font-medium">
                                    {viewMode === 'mockup' ? 'Updating model...' : 'Refining design...'}
                                </span>
                             </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100">
                    <div className="relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder={viewMode === 'mockup' ? "E.g. Change to a black hoodie..." : "E.g. Make it more colorful..."}
                            className="w-full bg-gray-100 text-vyllo-primary rounded-full pl-5 pr-12 py-3.5 text-sm focus:ring-2 focus:ring-gray-200 outline-none transition-all placeholder-gray-400"
                            disabled={isChatProcessing}
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!chatInput.trim() || isChatProcessing}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-vyllo-red text-white rounded-full hover:bg-red-700 disabled:opacity-50 disabled:bg-gray-300 transition-colors"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;