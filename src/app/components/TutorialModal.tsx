import * as React from 'react';
import { BookOpen, Compass, ShieldCheck, Sparkles } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';

export interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenConnect: () => void;
}

const GUIDE_SECTIONS = [
  {
    icon: Compass,
    title: '1. 个人命盘与真太阳时',
    body: '点击「命盘排盘」输入出生年月日时与出生地。建议开启真太阳时校准（系统内置全国省市区及海外主要城市经纬度）；若不确定具体时辰，可点击「我不知道时辰」通过节点逆推；排星盘或七政若不确定具体分秒，可在输入框下方进入大概区间排查。',
  },
  {
    icon: Sparkles,
    title: '2. 占卜起卦与原盘追问',
    body: '在「占卜起卦」支持六爻、梅花易数、奇门遁甲、大六壬、塔罗、雷诺曼、三山国王灵签等。排盘后如想换个问法，直接在右侧修改问题即可基于同一原盘重新生成提示词，不会重新抽牌或起卦。',
  },
  {
    icon: BookOpen,
    title: '3. 两种 AI 使用方式',
    body: '方式 A（零配置）：排盘后点「复制提示词」，直接粘贴给任意你常用的大模型（DeepSeek、豆包、ChatGPT、Kimi 等）。方式 B（站内直连）：去「接入 AI」填入你的接口地址和密钥，即可在网页内直接流式解读，或在首页直接和 AI 助手聊天自动调用排盘工具。',
  },
  {
    icon: ShieldCheck,
    title: '4. 隐私与本地数据说明',
    body: '所有排盘计算、个人档案、历史记录和模型密钥均保存在你自己的浏览器本地，不会上传到任何第三方统计服务器。如曾使用过 V1 旧版，系统会在你打开页面时自动将旧档案与历史记录无损迁移过来。',
  },
] as const;

export function TutorialModal({ open, onOpenChange, onOpenConnect }: TutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[660px]" aria-labelledby="tutorial-modal-title">
        <DialogHeader>
          <DialogTitle id="tutorial-modal-title">命语使用指南</DialogTitle>
          <DialogDescription>
            高精度术数排盘 · 结构化 AI 提示词 · 本地隐私运行
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 py-4">
          {GUIDE_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <div
                key={sec.title}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-strong)]">
                  <Icon className="h-4 w-4 text-[var(--accent)]" />
                  <span>{sec.title}</span>
                </div>
                <p className="m-0 mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {sec.body}
                </p>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              onOpenChange(false);
              onOpenConnect();
            }}
          >
            前往配置 AI 接口
          </Button>
          <Button variant="primary" size="md" onClick={() => onOpenChange(false)}>
            我知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
