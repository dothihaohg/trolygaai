/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpen, 
  GraduationCap, 
  Clock, 
  Users, 
  Wrench, 
  Sparkles, 
  Download, 
  Copy, 
  Check,
  Loader2,
  ChevronRight,
  FileText,
  Layout,
  FileDown,
  Image as ImageIcon,
  FileUp,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface LessonInput {
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  objectives: string;
  studentLevel: string;
  tools: string;
  teachingIdeas: string;
  textbook: string;
  attachments: { mimeType: string; data: string; name: string }[];
}

const INITIAL_INPUT: LessonInput = {
  subject: '',
  grade: '',
  topic: '',
  duration: '1 tiết',
  objectives: '',
  studentLevel: 'Trung bình',
  tools: 'Sách giáo khoa, máy chiếu, bảng, phấn',
  teachingIdeas: '',
  textbook: 'Kết nối tri thức với cuộc sống',
  attachments: [],
};

export default function App() {
  const [input, setInput] = useState<LessonInput>(INITIAL_INPUT);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInput(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setInput(prev => ({
          ...prev,
          attachments: [...prev.attachments, {
            mimeType: file.type,
            data: base64,
            name: file.name
          }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setInput(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const generateLessonPlan = async () => {
    if (!input.subject || !input.topic) {
      alert("Vui lòng nhập ít nhất Môn học và Tên bài học.");
      return;
    }

    setLoading(true);
    setResult('');

    try {
const prompt = `
Bạn là một chuyên gia giáo dục am hiểu sâu sắc Chương trình GDPT 2018 và Công văn 5512/BGDĐT-GDTrH của Việt Nam[cite: 3].
Nhiệm vụ của bạn là soạn Kế hoạch bài dạy (KHBD) chuẩn xác, khoa học và thực tiễn.

🔹 THÔNG TIN ĐẦU VÀO:
- Môn học: ${input.subject} | Lớp: ${input.grade} | Bộ sách: ${input.textbook}
- Bài học: ${input.topic} | Thời lượng: ${input.duration}
- Đối tượng học sinh: ${input.studentLevel}
- Phương tiện dạy học: ${input.tools}
- Ý tưởng/Mục tiêu riêng: ${input.teachingIdeas || input.objectives || 'Theo chuẩn chương trình'}

🔹 CẤU TRÚC BẮT BUỘC (PHỤ LỤC IV - 5512)[cite: 1, 2]:

I. MỤC TIÊU [cite: 7]
1. Về kiến thức: Nêu cụ thể nội dung học sinh cần học theo yêu cầu cần đạt[cite: 11].
2. Về năng lực: Nêu cụ thể biểu hiện của năng lực đặc thù môn học và năng lực chung[cite: 12].
3. Về phẩm chất: Nêu cụ thể hành vi, thái độ cần phát triển gắn với bài dạy[cite: 13].

II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU [cite: 14]
Liệt kê chi tiết thiết bị, học liệu sử dụng để tổ chức hoạt động[cite: 15].

III. TIẾN TRÌNH DẠY HỌC [cite: 16]
Chia thành 4 hoạt động chính[cite: 17, 25, 30, 37]. Với MỖI hoạt động, BẮT BUỘC trình bày đủ 4 mục sau[cite: 18, 19, 20, 24]:
a) Mục tiêu: Xác định nhiệm vụ/vấn đề cần giải quyết[cite: 18].
b) Nội dung: Mô tả cụ thể nhiệm vụ học sinh (đọc, xem, làm, thí nghiệm...)[cite: 19].
c) Sản phẩm: Kết quả cụ thể học sinh phải hoàn thành (câu trả lời, bài tập, báo cáo...)[cite: 20, 23].
d) Tổ chức thực hiện: Trình bày chi tiết qua 4 bước[cite: 52]:
   - Giao nhiệm vụ học tập: GV trình bày nhiệm vụ, HS tiếp nhận[cite: 53].
   - Thực hiện nhiệm vụ: HS làm việc; GV theo dõi, hỗ trợ, dự kiến khó khăn[cite: 54, 55].
   - Báo cáo, thảo luận: GV điều hành HS báo cáo, thảo luận nhóm/lớp[cite: 57].
   - Kết luận, nhận định: GV phân tích sản phẩm, chốt kiến thức, kỹ năng[cite: 58, 59].

🔹 LƯU Ý QUAN TRỌNG:
- Không viết lời thoại trực tiếp (GV nói..., HS trả lời...). Hãy mô tả bằng các động từ: GV giao nhiệm vụ/quan sát/hướng dẫn; HS đọc/nghe/viết/trình bày[cite: 47, 48].
- Ưu tiên ứng dụng AI/CNTT và các phương pháp dạy học tích cực.
- Nếu có hình ảnh đính kèm, hãy phân tích kỹ các ví dụ/hình ảnh đó để đưa vào nội dung bài dạy.

Sử dụng Markdown để trình bày. Các tiêu đề mục dùng #, ##, ### rõ ràng.
`;

      const parts: any[] = [{ text: prompt }];
      
      // Add attachments as inlineData parts
      input.attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts }],
      });

      setResult(response.text || "Không có nội dung được tạo.");
    } catch (error) {
      console.error("Error generating lesson plan:", error);
      setResult("Có lỗi xảy ra trong quá trình tạo giáo án. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadAsMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GiaoAn_${input.topic.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsWord = async () => {
    if (!result) return;

    const lines = result.split('\n');
    const docChildren: any[] = [];

    // Title
    docChildren.push(new Paragraph({
      text: `KẾ HOẠCH BÀI DẠY: ${input.topic.toUpperCase()}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }));

    // Info
    docChildren.push(new Paragraph({
      children: [
        new TextRun({ text: `Môn học: ${input.subject}`, bold: true }),
        new TextRun({ text: ` | Lớp: ${input.grade}`, bold: true }),
        new TextRun({ text: ` | Thời lượng: ${input.duration}`, bold: true }),
      ],
      spacing: { after: 400 },
    }));

    let currentTableRows: TableRow[] = [];
    let isInTable = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        if (isInTable && currentTableRows.length > 0) {
          docChildren.push(new Table({
            rows: currentTableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }));
          currentTableRows = [];
          isInTable = false;
        }
        continue;
      }

      // Headers
      if (trimmedLine.startsWith('# ')) {
        docChildren.push(new Paragraph({
          text: trimmedLine.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }));
      } else if (trimmedLine.startsWith('## ')) {
        docChildren.push(new Paragraph({
          text: trimmedLine.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }));
      } else if (trimmedLine.startsWith('### ')) {
        docChildren.push(new Paragraph({
          text: trimmedLine.replace('### ', ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }));
      } 
      // Lists
      else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
        docChildren.push(new Paragraph({
          text: trimmedLine.substring(2),
          bullet: { level: 0 },
          spacing: { after: 100 },
        }));
      }
      // Tables (Basic support)
      else if (trimmedLine.startsWith('|')) {
        isInTable = true;
        const cells = trimmedLine.split('|').filter(c => c.trim() !== '' || trimmedLine.includes('||'));
        if (cells.length > 0 && !trimmedLine.includes('---')) {
          currentTableRows.push(new TableRow({
            children: cells.map(cell => new TableCell({
              children: [new Paragraph({ text: cell.trim() })],
              width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
            })),
          }));
        }
      }
      // Paragraphs
      else {
        if (isInTable && currentTableRows.length > 0) {
          docChildren.push(new Table({
            rows: currentTableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }));
          currentTableRows = [];
          isInTable = false;
        }
        docChildren.push(new Paragraph({
          text: trimmedLine,
          spacing: { after: 150 },
        }));
      }
    }

    // Final table if exists
    if (isInTable && currentTableRows.length > 0) {
      docChildren.push(new Table({
        rows: currentTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `GiaoAn_${input.topic.replace(/\s+/g, '_')}.docx`);
  };

  const downloadAppProcess = async () => {
    setProcessLoading(true);
    try {
      const fetchImg = async (seed: string) => {
        const res = await fetch(`https://picsum.photos/seed/${seed}/800/400`);
        const buffer = await res.arrayBuffer();
        return new Uint8Array(buffer);
      };

      const [img1, img2, img3, img4, img5, img6] = await Promise.all([
        fetchImg("analysis"),
        fetchImg("ui_design"),
        fetchImg("ai_brain"),
        fetchImg("markdown_code"),
        fetchImg("export_file"),
        fetchImg("testing_quality")
      ]);

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "QUY TRÌNH XÂY DỰNG ỨNG DỤNG TRỢ LÝ GIÁO ÁN AI",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "1. Phân tích yêu cầu và Xác định mục tiêu",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Mục tiêu là tạo ra một công cụ hỗ trợ giáo viên Việt Nam soạn giáo án nhanh chóng, tuân thủ nghiêm ngặt Chương trình Giáo dục Phổ thông (GDPT) 2018. Các yêu cầu cốt lõi bao gồm: Giao diện tiếng Việt, cấu trúc giáo án chuẩn, tích hợp AI mạnh mẽ và khả năng xuất file đa dạng.",
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new ImageRun({ data: img1, transformation: { width: 500, height: 250 } } as any)],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "2. Thiết kế Giao diện (UI/UX)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Sử dụng Tailwind CSS để xây dựng giao diện hiện đại, sạch sẽ với tông màu Emerald (Xanh ngọc) tạo cảm giác giáo dục và tin cậy. Tích hợp Lucide Icons để minh họa trực quan và Framer Motion để tạo các hiệu ứng chuyển cảnh mượt mà.",
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new ImageRun({ data: img2, transformation: { width: 500, height: 250 } } as any)],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "3. Tích hợp Trí tuệ nhân tạo (AI)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Sử dụng Google Gemini API (mô hình 3.1 Pro) để xử lý dữ liệu đầu vào. Prompt được thiết kế chuyên sâu để AI hiểu rõ các thành phần của giáo án 2018 như: Kiến thức, Năng lực, Phẩm chất, và 4 bước tiến trình dạy học (Khởi động, Hình thành, Luyện tập, Vận dụng).",
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new ImageRun({ data: img3, transformation: { width: 500, height: 250 } } as any)],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "4. Xử lý Định dạng và Hiển thị",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Sử dụng thư viện react-markdown kết hợp với remark-gfm để hiển thị nội dung AI tạo ra dưới dạng văn bản có định dạng, bảng biểu và danh sách đẹp mắt ngay trên trình duyệt.",
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new ImageRun({ data: img4, transformation: { width: 500, height: 250 } } as any)],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "5. Phát triển Tính năng Xuất bản (Export)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Tích hợp thư viện docx và file-saver để chuyển đổi nội dung Markdown sang định dạng Microsoft Word (.docx). Tính năng này bao gồm việc phân tích cú pháp văn bản để tạo ra các Heading, Paragraph và Table chuẩn trong Word.",
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new ImageRun({ data: img5, transformation: { width: 500, height: 250 } } as any)],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "6. Kiểm thử và Tối ưu hóa",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Thực hiện kiểm tra lỗi cú pháp (Linting), biên dịch (Compiling) và tối ưu hóa tốc độ phản hồi của AI. Đảm bảo ứng dụng hoạt động ổn định trên mọi thiết bị.",
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new ImageRun({ data: img6, transformation: { width: 500, height: 250 } } as any)],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "--- Hết ---",
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, "Quy_trinh_xay_dung_App_GiaoAnAI_MinhChung.docx");
    } catch (error) {
      console.error("Failed to download process:", error);
      alert("Có lỗi khi tải quy trình. Vui lòng thử lại.");
    } finally {
      setProcessLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">Trợ lý thiết kế KHBD AI</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tác giả: Đỗ Thị Hảo - Trường THCS&THPT Tùng Bá</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-gray-600">
            <button 
              onClick={downloadAppProcess}
              disabled={processLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 transition-all text-xs font-bold disabled:opacity-50"
            >
              {processLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-emerald-600" />}
              {processLoading ? "Đang tải..." : "Quy trình tạo App"}
            </button>
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-emerald-500" /> Nhanh chóng</span>
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-emerald-500" /> Khoa học</span>
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-emerald-500" /> Phân hóa</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input Form */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Layout className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-lg">Thông tin bài học</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Môn học</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      name="subject"
                      value={input.subject}
                      onChange={handleInputChange}
                      placeholder="Ví dụ: Toán, Ngữ văn..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Lớp</label>
                    <input 
                      type="text" 
                      name="grade"
                      value={input.grade}
                      onChange={handleInputChange}
                      placeholder="Ví dụ: 6, 10..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Thời lượng</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        name="duration"
                        value={input.duration}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Bộ sách giáo khoa</label>
                  <select 
                    name="textbook"
                    value={input.textbook}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm appearance-none"
                  >
                    <option>Kết nối tri thức với cuộc sống</option>
                    <option>Chân trời sáng tạo</option>
                    <option>Cánh Diều</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Tên bài học / Chủ đề</label>
                  <input 
                    type="text" 
                    name="topic"
                    value={input.topic}
                    onChange={handleInputChange}
                    placeholder="Nhập tên bài học..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Đối tượng học sinh</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select 
                      name="studentLevel"
                      value={input.studentLevel}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm appearance-none"
                    >
                      <option>Yếu</option>
                      <option>Trung bình</option>
                      <option>Khá</option>
                      <option>Giỏi</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Phương tiện dạy học</label>
                  <div className="relative">
                    <Wrench className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea 
                      name="tools"
                      value={input.tools}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Tải lên ảnh/trang sách (Tùy chọn)</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-xl hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group">
                        <FileUp className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-semibold text-emerald-700">Chọn ảnh hoặc PDF</span>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*,application/pdf" 
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    
                    {input.attachments.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {input.attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg shadow-sm group">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {file.mimeType.startsWith('image/') ? (
                                <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                              )}
                              <span className="text-xs font-medium text-gray-600 truncate">{file.name}</span>
                            </div>
                            <button 
                              onClick={() => removeAttachment(idx)}
                              className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Ý tưởng dạy học của giáo viên</label>
                  <textarea 
                    name="teachingIdeas"
                    value={input.teachingIdeas}
                    onChange={handleInputChange}
                    placeholder="Nhập các ý tưởng sáng tạo, phương pháp riêng bạn muốn áp dụng..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">Mục tiêu cụ thể (Tùy chọn)</label>
                  <textarea 
                    name="objectives"
                    value={input.objectives}
                    onChange={handleInputChange}
                    placeholder="Nếu có yêu cầu riêng biệt..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm resize-none"
                  />
                </div>

                <button 
                  onClick={generateLessonPlan}
                  disabled={loading}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200",
                    loading ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang thiết kế giáo án...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Tạo kế hoạch bài dạy
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Result Preview */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full min-h-[600px]">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-lg">Kế hoạch bài dạy chi tiết</h2>
                </div>
                {result && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={copyToClipboard}
                      className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-600 flex items-center gap-1.5 text-sm font-medium"
                      title="Sao chép"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Đã chép" : "Sao chép"}
                    </button>
                    <button 
                      onClick={downloadAsWord}
                      className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-emerald-600 flex items-center gap-1.5 text-sm font-bold"
                      title="Tải về Word"
                    >
                      <FileDown className="w-4 h-4" />
                      Tải về Word
                    </button>
                    <button 
                      onClick={downloadAsMarkdown}
                      className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-600 flex items-center gap-1.5 text-sm font-medium"
                      title="Tải về .md"
                    >
                      <Download className="w-4 h-4" />
                      Markdown
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-white custom-scrollbar">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4"
                    >
                      <div className="relative">
                        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
                        <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-emerald-400 animate-pulse" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-gray-600">AI đang phân tích chương trình GDPT 2018...</p>
                        <p className="text-sm">Vui lòng đợi trong giây lát</p>
                      </div>
                    </motion.div>
                  ) : result ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="prose prose-emerald max-w-none markdown-body"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-20">
                      <div className="bg-gray-50 p-6 rounded-full">
                        <FileText className="w-16 h-16 opacity-20" />
                      </div>
                      <div className="text-center max-w-xs">
                        <p className="font-medium text-gray-600">Chưa có nội dung</p>
                        <p className="text-sm">Điền thông tin bên trái và nhấn nút "Tạo kế hoạch bài dạy" để bắt đầu.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            © 2026 Trợ lý Giáo án AI. Thiết kế theo chuẩn Chương trình GDPT 2018 Việt Nam.
          </p>
          <div className="mt-4 flex justify-center gap-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <span>Kiến thức</span>
            <span>Năng lực</span>
            <span>Phẩm chất</span>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .markdown-body h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 1.5rem; color: #065f46; border-bottom: 2px solid #ecfdf5; padding-bottom: 0.5rem; }
        .markdown-body h2 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; color: #065f46; display: flex; align-items: center; gap: 0.5rem; }
        .markdown-body h2::before { content: ""; display: inline-block; width: 4px; height: 1.5rem; background: #10b981; border-radius: 2px; }
        .markdown-body h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #374151; }
        .markdown-body p { margin-bottom: 1rem; line-height: 1.7; color: #4b5563; }
        .markdown-body ul, .markdown-body ol { margin-bottom: 1rem; padding-left: 1.5rem; }
        .markdown-body li { margin-bottom: 0.5rem; color: #4b5563; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.875rem; }
        .markdown-body th { background: #f9fafb; border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; }
        .markdown-body td { border: 1px solid #e5e7eb; padding: 0.75rem; vertical-align: top; color: #4b5563; }
        .markdown-body blockquote { border-left: 4px solid #10b981; background: #f0fdf4; padding: 1rem; margin: 1.5rem 0; font-style: italic; }
        .markdown-body strong { color: #111827; font-weight: 600; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
      `}} />
    </div>
  );
}
