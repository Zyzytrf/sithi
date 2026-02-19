
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Language } from "../types";

export const getShoppingAdvice = async (query: string, products: Product[], lang: Language) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const productListString = products.map(p => {
      const priceStr = typeof p.price === 'number' ? `${p.price} LKR` : p.price[lang];
      const catStr = p.category[lang];
      return `${p.name[lang]} (Giá: ${priceStr}, Danh mục: ${catStr})`;
    }).join(', ');
    
    const instructions: Record<Language, string> = {
      vi: "Bạn là chuyên gia tư vấn tại Siêu thị Srilanka. Hãy đưa ra lời khuyên mua sắm ngắn gọn, thân thiện dựa trên danh sách sản phẩm có sẵn.",
      en: "You are a shopping assistant at Srilanka Market. Provide brief, friendly advice based on the available product list.",
      zh: "您是斯里兰卡超市的购物助理。请根据现有产品列表提供简短、友好的建议。"
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${instructions[lang]} Danh sách sản phẩm: [${productListString}]. Khách hàng hỏi: "${query}".`,
      config: {
        temperature: 0.7,
        topP: 0.9,
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini advice error:", error);
    return null;
  }
};

export const searchProductsSmartly = async (query: string, products: Product[], lang: Language) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Hệ thống: Bạn là bộ não tìm kiếm của Siêu thị Srilanka.
        Nhiệm vụ: Tìm các sản phẩm phù hợp nhất với câu truy vấn của người dùng dựa trên ý định (semantic search).
        Ví dụ: "đồ nấu lẩu" -> tìm hải sản, gia vị. "đồ nhắm" -> tìm bia, bánh kẹo, tôm khô.
        
        Danh sách sản phẩm (ID và Tên): ${JSON.stringify(products.map(p => ({id: p.id, name: p.name[lang], cat: p.category[lang]})))}
        Câu truy vấn của người dùng: "${query}"
        
        Yêu cầu: Trả về JSON chứa mảng các ID sản phẩm phù hợp nhất.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{"matches": []}');
    return result.matches as string[];
  } catch (error) {
    console.error("Smart search error:", error);
    return [];
  }
};

export const getSmartSuggestions = async (lang: Language) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gợi ý 4 cụm từ tìm kiếm ngắn gọn (2-3 từ) về đồ ăn/hải sản/tiêu dùng phù hợp cho người dùng siêu thị vào lúc này. Ngôn ngữ: ${lang === 'vi' ? 'Tiếng Việt' : 'English'}. Trả về JSON array string.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text) as string[];
  } catch (error) {
    return lang === 'vi' ? ["Hải sản tươi", "Đồ nhắm bia", "Gia vị lẩu", "Bánh kẹo"] : ["Fresh Seafood", "Beer snacks", "Hotpot spices", "Sweets"];
  }
};

export const generateCookingSuggestion = async (product: Product, lang: Language) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Gợi ý 1 món ngon từ ${product.name[lang]}. Ngôn ngữ: ${lang}. Ngắn gọn 2 câu.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return null;
  }
};
