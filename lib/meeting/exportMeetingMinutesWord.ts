import { message } from 'antd';
import type { MeetingMinutes } from '@/dtos/meeting.dto';
import {
  buildExportFileName,
  formatViDateTime,
  formatViTime,
  formatVietnamDateLine,
  getEndedDisplayText,
} from '@/lib/meetingMinutesFormat';

/** Xuất biên bản cuộc họp ra file .docx (client-only). */
export async function exportMeetingMinutesWord(minutes: MeetingMinutes): Promise<void> {
  try {
    const {
      AlignmentType,
      BorderStyle,
      Document,
      Packer,
      Paragraph,
      Table,
      TableCell,
      TableRow,
      TextRun,
      VerticalAlign,
      WidthType,
    } = await import('docx');
    const signAt = minutes.endedAtEstimated ?? minutes.startedAt;
    const endedLine = getEndedDisplayText(minutes);
    const run = (text: string, bold = false) =>
      new TextRun({
        text,
        bold,
        font: 'Times New Roman',
        size: 28, // 14pt
      });

    const paragraphs: any[] = [];
    const push = (
      text: string,
      alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
      bold = false,
      after = 140,
    ) => {
      paragraphs.push(
        new Paragraph({
          alignment,
          spacing: { after },
          children: [run(text, bold)],
        }),
      );
    };

    push('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', AlignmentType.CENTER, true, 80);
    push('Độc lập - Tự do - Hạnh phúc', AlignmentType.CENTER, true, 80);
    push('--------------------', AlignmentType.CENTER, false, 220);
    push(formatVietnamDateLine(signAt), AlignmentType.RIGHT, false, 220);

    push('BIÊN BẢN CUỘC HỌP', AlignmentType.CENTER, true, 80);
    push(`Biên bản cuộc họp về: ${minutes.title}`, AlignmentType.CENTER, false, 220);

    push('1. Thời gian, địa điểm', AlignmentType.LEFT, true);
    push(`- Bắt đầu lúc: ${formatViDateTime(minutes.startedAt)}`);
    push(`- Kết thúc lúc: ${endedLine}`);
    push(`- Địa điểm: ${minutes.locationLabel} (${minutes.locationDetail})`, AlignmentType.LEFT, false, 220);

    push('2. Thành phần tham dự', AlignmentType.LEFT, true);
    push(`- Chủ trì: ${minutes.hostName}`);
    push(`- Và ${minutes.participantCount} thành viên`);
    minutes.participants.forEach((p) => push(`   • ${p.displayName}`));
    push('', AlignmentType.LEFT, false, 100);

    push('3. Tiến trình cuộc họp', AlignmentType.LEFT, true);
    if (minutes.transcript.length === 0) {
      push('(Không có transcript)');
    } else {
      minutes.transcript.forEach((t) =>
        push(`${formatViTime(t.at)} - ${t.speakerName}: "${t.text}"`),
      );
    }
    push('', AlignmentType.LEFT, false, 100);

    if (minutes.polls.length > 0) {
      push('4. Kết quả biểu quyết', AlignmentType.LEFT, true);
      minutes.polls.forEach((poll, i) => {
        push(`- Biểu quyết ${i + 1}. ${poll.title} (${poll.status})`);
        poll.options.forEach((opt, idx) => {
          push(`   • ${opt}: ${poll.optionVoteCounts[String(idx)] ?? 0} phiếu`);
        });
      });
      push('', AlignmentType.LEFT, false, 140);
    }

    push(`${minutes.polls.length > 0 ? '5' : '4'}. Kết thúc cuộc họp`, AlignmentType.LEFT, true, 180);

    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          height: { value: 2600, rule: 'exact' },
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [run(' ')] })],
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 80 },
                  children: [run('Chủ trì')],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 700 },
                  children: [run('(Ký, ghi rõ họ tên)')],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [run(minutes.hostName)],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    paragraphs.push(signatureTable);

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134,
                right: 1134,
                bottom: 1134,
                left: 1701,
              },
            },
          },
          children: paragraphs,
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildExportFileName(minutes)}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    message.success('Đã xuất file Word');
  } catch (e) {
    console.error(e);
    message.error('Xuất Word thất bại');
  }
}
