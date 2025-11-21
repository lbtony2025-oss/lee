import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// --- API Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = "gemini-2.5-flash-image";

// --- Types ---
type Step = 1 | 2 | 3;

interface HistoryItem {
  person: string;
  cloth: string;
  result: string;
  timestamp: number;
}

// --- Components ---

const App = () => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [personImg, setPersonImg] = useState<string | null>(null);
  const [clothImg, setClothImg] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  
  const [clothPrompt, setClothPrompt] = useState("");
  const [generatedClothes, setGeneratedClothes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Helper: Convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'person' | 'cloth') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64 = await fileToBase64(file);
      if (type === 'person') {
        setPersonImg(base64);
        setCurrentStep(2);
      } else {
        setClothImg(base64);
      }
    } catch (err) {
      console.error("Error reading file:", err);
    }
  };

  // Step 2: Generate Clothing using Nano Banana
  const generateClothing = async () => {
    if (!clothPrompt.trim()) return;
    setIsGenerating(true);

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [{ text: `Generate a high-quality image of clothing: ${clothPrompt}. Flat lay or on a mannequin, white background, clean lighting.` }]
        }
      });

      // Extract image from response
      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
             const imgUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
             setGeneratedClothes(prev => [imgUrl, ...prev]);
             setClothImg(imgUrl); // Auto-select new generation
             foundImage = true;
          }
        }
      }
      
      if (!foundImage) {
        alert("未生成图片，请重试或修改提示词。");
      }

    } catch (error) {
      console.error("Clothing generation failed", error);
      alert("生成失败，请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 3: Generate Try-On Result using Nano Banana
  const generateTryOn = async () => {
    if (!personImg || !clothImg) return;
    setIsGenerating(true);

    try {
      // Clean base64 strings for API
      const cleanPerson = personImg.split(',')[1];
      const cleanCloth = clothImg.split(',')[1];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png', // Assuming standard upload, or detect via regex
                data: cleanPerson
              }
            },
            {
              inlineData: {
                mimeType: 'image/png',
                data: cleanCloth
              }
            },
            {
              text: "Use the first image as the person and the second image as the clothing. Generate a high-quality, photorealistic full-body photo of the person wearing this clothing. Maintain the person's facial features and body shape accurately. Ensure the clothing fits naturally."
            }
          ]
        }
      });

      let foundImage = false;
       if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
             const resultUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
             setResultImg(resultUrl);
             setHistory(prev => [{ person: personImg, cloth: clothImg, result: resultUrl, timestamp: Date.now() }, ...prev]);
             foundImage = true;
          }
        }
      }

      if (!foundImage) {
         alert("生成换装图片失败，请重试。");
      }

    } catch (error) {
      console.error("Try-on generation failed", error);
      alert("生成失败，可能因为图片内容安全过滤，请更换图片重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- UI Sections ---

  // The 3 Tilted Cards Header
  const renderVisualizer = () => {
    return (
      <div className="w-full h-64 md:h-80 relative flex justify-center items-center perspective-container mb-8 mt-4">
        {/* Card 1: Person */}
        <div 
          className={`absolute w-48 h-64 md:w-56 md:h-72 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 transition-all duration-500 ease-out ${currentStep === 1 ? 'z-30 scale-105 border-indigo-500' : 'z-10 opacity-60 scale-95 border-white'} card-tilt`}
          style={{ transform: currentStep === 1 ? 'translateX(0) rotate(0deg)' : 'translateX(-120px) rotate(-6deg) scale(0.9)' }}
          onClick={() => setCurrentStep(1)}
        >
          {personImg ? (
            <img src={personImg} className="w-full h-full object-cover" alt="Person" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
              <i className="fas fa-user text-4xl mb-2"></i>
              <span>人像</span>
            </div>
          )}
        </div>

        {/* Card 2: Cloth */}
        <div 
          className={`absolute w-48 h-64 md:w-56 md:h-72 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 transition-all duration-500 ease-out ${currentStep === 2 ? 'z-30 scale-105 border-indigo-500' : 'z-20 opacity-70 scale-95 border-white'} card-tilt`}
          style={{ transform: currentStep === 2 ? 'translateX(0) rotate(0deg)' : (currentStep === 1 ? 'translateX(120px) rotate(6deg) scale(0.9)' : 'translateX(-120px) rotate(-6deg) scale(0.9)') }}
          onClick={() => personImg && setCurrentStep(2)}
        >
          {clothImg ? (
            <img src={clothImg} className="w-full h-full object-cover" alt="Cloth" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
              <i className="fas fa-tshirt text-4xl mb-2"></i>
              <span>衣物</span>
            </div>
          )}
        </div>

        {/* Card 3: Result */}
        <div 
          className={`absolute w-48 h-64 md:w-56 md:h-72 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 transition-all duration-500 ease-out ${currentStep === 3 ? 'z-30 scale-105 border-indigo-500' : 'z-10 opacity-60 scale-95 border-white'} card-tilt`}
          style={{ transform: currentStep === 3 ? 'translateX(0) rotate(0deg)' : 'translateX(120px) rotate(6deg) scale(0.9)' }}
        >
          {resultImg ? (
            <img src={resultImg} className="w-full h-full object-cover" alt="Result" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
              <i className="fas fa-wand-magic-sparkles text-4xl mb-2"></i>
              <span>效果</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Step 1 UI
  const renderStep1 = () => (
    <div className="flex flex-col items-center animate-fade-in">
      <h2 className="text-xl font-semibold text-slate-700 mb-6">Step 1: 上传您的人像照片</h2>
      <label className="cursor-pointer group">
        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'person')} />
        <div className="w-64 h-40 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-white group-hover:border-indigo-400 group-hover:bg-indigo-50 transition-colors">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <i className="fas fa-plus text-xl"></i>
          </div>
          <span className="text-slate-500 group-hover:text-indigo-600">点击上传照片</span>
        </div>
      </label>
    </div>
  );

  // Step 2 UI
  const renderStep2 = () => (
    <div className="flex flex-col w-full max-w-2xl mx-auto animate-fade-in px-4">
      <h2 className="text-xl font-semibold text-slate-700 mb-4 text-center">Step 2: 选择或生成服装</h2>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex space-x-4 mb-6 border-b border-slate-100 pb-4">
          <button className="text-indigo-600 font-medium border-b-2 border-indigo-600 pb-1">AI 生成服装</button>
          <label className="text-slate-400 font-medium cursor-pointer hover:text-indigo-500 transition-colors">
             本地上传
             <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cloth')} />
          </label>
        </div>

        {/* Generator */}
        <div className="flex space-x-2 mb-6">
          <input 
            type="text" 
            value={clothPrompt}
            onChange={(e) => setClothPrompt(e.target.value)}
            placeholder="输入想要的衣服描述（例如：一件红色的丝绸晚礼服）..." 
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            onClick={generateClothing}
            disabled={isGenerating || !clothPrompt}
            className={`px-6 py-3 rounded-xl text-white font-medium shadow-md transition-all ${isGenerating || !clothPrompt ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'}`}
          >
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : '生成'}
          </button>
        </div>

        {/* Presets Grid */}
        <div className="mb-2">
          <p className="text-sm text-slate-400 mb-3">预设与生成历史</p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {/* Pre-fill with uploaded if any */}
            {clothImg && !generatedClothes.includes(clothImg) && (
               <div className="aspect-square rounded-lg overflow-hidden ring-2 ring-indigo-500 cursor-pointer relative">
                 <img src={clothImg} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/10"></div>
               </div>
            )}
            
            {generatedClothes.map((img, idx) => (
              <div 
                key={idx} 
                onClick={() => setClothImg(img)}
                className={`aspect-square rounded-lg overflow-hidden cursor-pointer transition-all hover:opacity-90 relative group ${clothImg === img ? 'ring-2 ring-indigo-500' : 'ring-1 ring-slate-200'}`}
              >
                <img src={img} className="w-full h-full object-cover" />
                {clothImg === img && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                    <i className="fas fa-check text-white text-[10px]"></i>
                  </div>
                )}
              </div>
            ))}
            
            {/* Placeholders if empty */}
            {generatedClothes.length === 0 && !clothImg && (
               <div className="col-span-full text-center py-8 text-slate-300 text-sm italic">
                 暂无衣服，请输入描述生成或上传图片
               </div>
            )}
          </div>
        </div>
      </div>

      {clothImg && (
        <button 
          onClick={() => { setCurrentStep(3); generateTryOn(); }}
          className="mt-6 mx-auto bg-indigo-600 text-white px-12 py-3 rounded-full shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all font-medium text-lg"
        >
          下一步：开始换装 <i className="fas fa-arrow-right ml-2"></i>
        </button>
      )}
    </div>
  );

  // Step 3 UI
  const renderStep3 = () => (
    <div className="flex flex-col items-center animate-fade-in px-4">
      <h2 className="text-xl font-semibold text-slate-700 mb-6">Step 3: 换装结果</h2>
      
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center h-64">
           <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
           <p className="text-slate-500 animate-pulse">AI 正在为您量身定做...</p>
        </div>
      ) : resultImg ? (
        <div className="flex flex-col items-center">
          <div className="flex gap-4 mb-6">
             <button 
               onClick={() => setCurrentStep(2)}
               className="px-6 py-2 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
             >
               重试衣物
             </button>
             <button 
               onClick={() => {
                 setPersonImg(null);
                 setClothImg(null);
                 setResultImg(null);
                 setCurrentStep(1);
               }}
               className="px-6 py-2 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors"
             >
               新的人物
             </button>
          </div>
          <a href={resultImg} download="try-on-result.png" className="text-sm text-indigo-500 hover:underline">
            <i className="fas fa-download mr-1"></i> 下载高清大图
          </a>
        </div>
      ) : (
        <div className="text-red-400">生成出现错误，请返回重试</div>
      )}
    </div>
  );

  // Bottom Gallery
  const renderGallery = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
      <div className="max-w-5xl mx-auto">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">History Gallery</h3>
        <div className="flex space-x-4 overflow-x-auto hide-scrollbar pb-2">
          {history.length === 0 && (
            <span className="text-sm text-slate-400">历史记录为空</span>
          )}
          {history.map((item, idx) => (
            <div key={item.timestamp} className="flex-shrink-0 relative group w-20 h-20 rounded-lg overflow-hidden cursor-pointer ring-1 ring-slate-200 hover:ring-indigo-400 transition-all" onClick={() => setResultImg(item.result)}>
               <img src={item.result} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-32 relative">
      {/* Header Title */}
      <header className="pt-6 px-6 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
          AI 智能换装 <span className="text-indigo-600">Studio</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">Powered by Gemini Nano Banana</p>
      </header>

      {/* 3D Visualizer Area */}
      {renderVisualizer()}

      {/* Main Action Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </main>

      {/* Gallery */}
      {renderGallery()}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
