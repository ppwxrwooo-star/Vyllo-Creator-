export enum DesignType {
  STICKER = 'Sticker',
  FASHION = 'Fashion Print',
  MOCKUP = 'Virtual Try-On'
}

export enum StickerStyle {
  // Existing
  KAWAII = 'Kawaii / Cute',
  VINTAGE = 'Vintage / Retro',
  PIXEL = 'Pixel Art',
  HOLOGRAPHIC = 'Holographic',
  WATERCOLOR = 'Watercolor',
  POP_ART = 'Pop Art',
  MINIMALIST = 'Minimalist',
  THREE_D = '3D Clay Render',
  
  // New Fashion Styles
  STREETWEAR = 'Streetwear / Urban',
  Y2K = 'Y2K / Cyber',
  LUXURY = 'Luxury / High-End',
  GOTHIC = 'Gothic / Dark',
  ACID_GRAPHIC = 'Acid Graphic / Rave',
  VAPORWAVE = 'Vaporwave',
  COTTAGECORE = 'Cottagecore'
}

export interface GeneratedSticker {
  id: string;
  prompt: string;
  style: StickerStyle;
  type?: DesignType; // Added type distinction
  imageUrl: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachmentUrl?: string; 
  relatedPrompt?: string; 
}

export interface GenerationConfig {
  prompt: string;
  style: StickerStyle;
  type: DesignType;
}