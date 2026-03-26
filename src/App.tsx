/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
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
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';

/// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normalize math so ReactMarkdown + KaTeX render correctly
function normalizeMath(text: string) {
  return text
    .replace(/\\\[(.*?)\\\]/gs, (_, expr) => `$$${expr.trim()}$$`)
    .replace(/\\\((.*?)\\\)/gs, (_, expr) => `$${expr.trim()}$`)
    .replace(/\\\$/g, '$')
    .replace(/\$\s+/g, '$')
    .replace(/\s+\$/g, '$');
}

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { apiVersion: 'v1' },
});

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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setInput((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const raw = event.target?.result as string;
        const base64 = raw.split(',')[1];
        setInput((prev) => ({
          ...prev,
          attachments: [
            ...prev.attachments,
            {
              mimeType: file.type || 'application/octet-stream',
              data: base64,
              name: file.name,
            },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setInput((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(parts: any[], maxRetries = 4) {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts }],
      });

      return response;
    } catch (error: any) {
      lastError = error;

      const message = String(error?.message || '');
      const is503 =
        message.includes('"code":503') ||
        message.includes('503') ||
        message.includes('UNAVAILABLE') ||
        message.includes('high demand');

      if (!is503 || attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(2000 * Math.pow(2, attempt), 15000);
      await sleep(delay);
    }
  }

  throw lastError;
}
  
  const generateLessonPlan = async () => {
    if (!input.subject || !input.topic) {
      alert('Vui lòng nhập ít nhất Môn học và Tên bài học.');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const prompt = `
Bạn là một chuyên gia giáo dục am hiểu sâu sắc Chương trình GDPT 2018 và Công văn 5512/BGDĐT-GDTrH của Việt Nam.
Nhiệm vụ của bạn là soạn Kế hoạch bài dạy (KHBD) chuẩn xác, khoa học và thực tiễn.

THÔNG TIN ĐẦU VÀO:
- Môn học: ${input.subject}
- Lớp: ${input.grade}
- Bộ sách: ${input.textbook}
- Bài học: ${input.topic}
- Thời lượng: ${input.duration}
- Đối tượng học sinh: ${input.studentLevel}
- Phương tiện dạy học: ${input.tools}
- Ý tưởng/Mục tiêu riêng: ${input.teachingIdeas || input.objectives || 'Theo chuẩn chương trình'}

CẤU TRÚC BẮT BUỘC:
# I. MỤC TIÊU
1. Về kiến thức
2. Về năng lực
3. Về phẩm chất

# II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU

# III. TIẾN TRÌNH DẠY HỌC
Chia thành 4 hoạt động chính.
Với MỖI hoạt động, BẮT BUỘC có đủ 4 mục:
a) Mục tiêu
b) Nội dung
c) Sản phẩm
d) Tổ chức thực hiện

Trong mục "d) Tổ chức thực hiện", trình bày rõ 4 bước:
- Giao nhiệm vụ học tập
- Thực hiện nhiệm vụ
- Báo cáo, thảo luận
- Kết luận, nhận định

LƯU Ý QUAN TRỌNG:
- Không viết lời thoại trực tiếp kiểu “GV nói”, “HS trả lời”.
- Mô tả theo hành động: GV giao nhiệm vụ, quan sát, hướng dẫn; HS đọc, viết, trình bày, thảo luận...
- Ưu tiên ứng dụng AI/CNTT và phương pháp dạy học tích cực.
- Nếu có tệp đính kèm, hãy phân tích và sử dụng chúng làm căn cứ xây dựng bài dạy.
- Trả về bằng Markdown rõ ràng.
- Khi có công thức toán hoặc vật lí, bắt buộc dùng LaTeX chuẩn:
  - Công thức trong dòng: $...$
  - Công thức riêng dòng: $$...$$
- Không escape ký hiệu đô la. Không viết \\$...$.
- Ví dụ đúng:
  - $s \\sim t^2$
  - $v = gt$
  - $$s = \\frac{1}{2}gt^2$$
`;

      const parts: any[] = [{ text: prompt }];

      input.attachments.forEach((att) => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data,
          },
        });
      });

      const response = await generateWithRetry(parts, 4);

      const rawText = response.text || 'Không có nội dung được tạo.';
      setResult(normalizeMath(rawText));
} catch (error: any) {
  console.error('Error generating lesson plan:', error);

  const message = String(error?.message || '');

  if (
    message.includes('"code":503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('high demand')
  ) {
    setResult(
      'Máy chủ AI đang quá tải tạm thời (503 - UNAVAILABLE). Ứng dụng đã thử lại nhưng chưa thành công. Vui lòng đợi 1-3 phút rồi thử lại.'
    );
  } else {
    setResult('Có lỗi xảy ra trong quá trình tạo giáo án. Vui lòng thử lại.');
  }
}
    finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
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

    docChildren.push(
      new Paragraph({
        text: `KẾ HOẠCH BÀI DẠY: ${input.topic.toUpperCase()}`,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );

    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Môn học: ${input.subject}`, bold: true }),
          new TextRun({ text: ` | Lớp: ${input.grade}`, bold: true }),
          new TextRun({ text: ` | Thời lượng: ${input.duration}`, bold: true }),
        ],
        spacing: { after: 400 },
      }),
    );

    let currentTableRows: TableRow[] = [];
    let isInTable = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        if (isInTable && currentTableRows.length > 0) {
          docChildren.push(
            new Table({
              rows: currentTableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          );
          currentTableRows = [];
          isInTable = false;
        }
        continue;
      }

      if (trimmedLine.startsWith('# ')) {
        docChildren.push(
          new Paragraph({
            text: trimmedLine.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
        );
      } else if (trimmedLine.startsWith('## ')) {
        docChildren.push(
          new Paragraph({
            text: trimmedLine.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          }),
        );
      } else if (trimmedLine.startsWith('### ')) {
        docChildren.push(
          new Paragraph({
            text: trimmedLine.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          }),
        );
      } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
        docChildren.push(
          new Paragraph({
            text: trimmedLine.substring(2),
            bullet: { level: 0 },
            spacing: { after: 100 },
          }),
        );
      } else if (trimmedLine.startsWith('|')) {
        isInTable = true;
        const cells = trimmedLine
          .split('|')
          .filter((c) => c.trim() !== '' || trimmedLine.includes('||'));

        if (cells.length > 0 && !trimmedLine.includes('---')) {
          currentTableRows.push(
            new TableRow({
              children: cells.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph({ text: cell.trim() })],
                    width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
                  }),
              ),
            }),
          );
        }
      } else {
        if (isInTable && currentTableRows.length > 0) {
          docChildren.push(
            new Table({
              rows: currentTableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          );
          currentTableRows = [];
          isInTable = false;
        }

        docChildren.push(
          new Paragraph({
            text: trimmedLine,
            spacing: { after: 150 },
          }),
        );
      }
    }

    if (isInTable && currentTableRows.length > 0) {
      docChildren.push(
        new Table({
          rows: currentTableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      );
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
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
        fetchImg('analysis'),
        fetchImg('ui_design'),
        fetchImg('ai_brain'),
        fetchImg('markdown_code'),
        fetchImg('export_file'),
        fetchImg('testing_quality'),
      ]);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: 'QUY TRÌNH XÂY DỰNG ỨNG DỤNG TRỢ LÝ GIÁO ÁN AI',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              new Paragraph({
                text: '1. Phân tích yêu cầu và Xác định mục tiêu',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                text: 'Mục tiêu là tạo ra một công cụ hỗ trợ giáo viên Việt Nam soạn giáo án nhanh chóng, tuân thủ nghiêm ngặt Chương trình Giáo dục Phổ thông 2018. Các yêu cầu cốt lõi bao gồm: giao diện tiếng Việt, cấu trúc giáo án chuẩn, tích hợp AI mạnh mẽ và khả năng xuất file đa dạng.',
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new ImageRun({ data: img1, transformation: { width: 500, height: 250 } } as any)],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                text: '2. Thiết kế Giao diện (UI/UX)',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                text: 'Sử dụng Tailwind CSS để xây dựng giao diện hiện đại, sạch sẽ với tông màu Emerald. Tích hợp Lucide Icons để minh họa trực quan và Motion để tạo hiệu ứng chuyển cảnh mượt mà.',
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new ImageRun({ data: img2, transformation: { width: 500, height: 250 } } as any)],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                text: '3. Tích hợp Trí tuệ nhân tạo (AI)',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                text: 'Sử dụng Google Gemini API để xử lý dữ liệu đầu vào. Prompt được thiết kế để AI tạo kế hoạch bài dạy chuẩn cấu trúc mục tiêu, thiết bị dạy học và tiến trình 4 bước.',
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new ImageRun({ data: img3, transformation: { width: 500, height: 250 } } as any)],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                text: '4. Xử lý Định dạng và Hiển thị',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                text: 'Sử dụng react-markdown kết hợp remark-gfm, remark-math và rehype-katex để hiển thị nội dung có định dạng, bảng biểu và công thức toán học 2D ngay trên trình duyệt.',
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new ImageRun({ data: img4, transformation: { width: 500, height: 250 } } as any)],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                text: '5. Phát triển Tính năng Xuất bản (Export)',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                text: 'Tích hợp thư viện docx và file-saver để chuyển đổi nội dung Markdown sang định dạng Microsoft Word. Tính năng này hỗ trợ heading, đoạn văn và bảng.',
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new ImageRun({ data: img5, transformation: { width: 500, height: 250 } } as any)],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                text: '6. Kiểm thử và Tối ưu hóa',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                text: 'Thực hiện kiểm tra lỗi cú pháp, biên dịch và tối ưu tốc độ phản hồi của AI. Đảm bảo ứng dụng hoạt động ổn định trên nhiều thiết bị.',
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new ImageRun({ data: img6, transformation: { width: 500, height: 250 } } as any)],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                text: '--- Hết ---',
                alignment: AlignmentType.CENTER,
                spacing: { before: 400 },
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'Quy_trinh_xay_dung_App_GiaoAnAI_MinhChung.docx');
    } catch (error) {
      console.error('Failed to download process:', error);
      alert('Có lỗi khi tải quy trình. Vui lòng thử lại.');
    } finally {
      setProcessLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">Trợ lý thiết kế KHBD AI</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Tác giả: Đỗ Thị Hảo - Trường THCS&THPT Tùng Bá
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-gray-600">
            <button
              onClick={downloadAppProcess}
              disabled={processLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 transition-all text-xs font-bold disabled:opacity-50"
            >
              {processLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-emerald-600" />
              )}
              {processLoading ? 'Đang tải...' : 'Quy trình tạo App'}
            </button>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" /> Nhanh chóng
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" /> Khoa học
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" /> Phân hóa
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Layout className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-lg">Thông tin bài học</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                    Môn học
                  </label>
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
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                      Lớp
                    </label>
                    <input
                      type="text"
                      name="grade"
                      value={input.grade}
                      onChange={handleInputChange}
                      placeholder="Ví dụ: 10"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                      Thời lượng
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="duration"
                        value={input.duration}
                        onChange={handleInputChange}
                        placeholder="Ví dụ: 1 tiết"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                    Bộ sách giáo khoa
                  </label>
                  <input
                    type="text"
                    name="textbook"
                    value={input.textbook}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                    Tên bài học / chủ đề
                  </label>
                  <input
                    type="text"
                    name="topic"
                    value={input.topic}
                    onChange={handleInputChange}
                    placeholder="Nhập tên bài học"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                    Đối tượng học sinh
                  </label>
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
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                    Phương tiện dạy học
                  </label>
                  <div className="relative">
                    <Wrench className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      name="tools"
                      value={input.tools}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                    Ý tưởng / yêu cầu riêng
                  </label>
                  <textarea
                    name="teachingIdeas"
                    value={input.teachingIdeas}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Ví dụ: tăng cường hoạt động nhóm, có ứng dụng AI, phân hóa học sinh..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wide">
                    Tải lên ảnh/trang sách (tùy chọn)
                  </label>

                  <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-emerald-300 rounded-xl px-4 py-4 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer text-sm font-medium text-emerald-700">
                    <FileUp className="w-4 h-4" />
                    Chọn ảnh hoặc PDF
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {input.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {input.attachments.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ImageIcon className="w-4 h-4 text-gray-500 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="text-gray-400 hover:text-red-500 transition"
                            type="button"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={generateLessonPlan}
                  disabled={loading}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-semibold transition-all',
                    loading
                      ? 'bg-emerald-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm',
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang tạo giáo án...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Tạo kế hoạch bài dạy
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          <div className="lg:col-span-8">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[700px] overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-lg">Kế hoạch bài dạy chi tiết</h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={copyToClipboard}
                    disabled={!result}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Đã sao chép' : 'Sao chép'}
                  </button>

                  <button
                    onClick={downloadAsWord}
                    disabled={!result}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm disabled:opacity-50 text-emerald-700"
                  >
                    <Download className="w-4 h-4" />
                    Tải về Word
                  </button>

                  <button
                    onClick={downloadAsMarkdown}
                    disabled={!result}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Markdown
                  </button>
                </div>
              </div>

              <div ref={resultRef} className="p-6">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
                      <p className="text-gray-600 font-medium">AI đang xây dựng kế hoạch bài dạy...</p>
                      <p className="text-sm text-gray-400 mt-1">Vui lòng chờ trong giây lát.</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-table:w-full prose-table:border prose-th:border prose-td:border prose-th:bg-gray-50 prose-img:rounded-xl prose-pre:bg-gray-50"
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {result}
                      </ReactMarkdown>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                        <Sparkles className="w-7 h-7 text-emerald-600" />
                      </div>
                      <p className="text-gray-700 font-medium">Chưa có nội dung giáo án</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Hãy nhập thông tin bài học và bấm “Tạo kế hoạch bài dạy”.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
