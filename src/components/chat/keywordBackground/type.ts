export type KeywordBackgroundProps = {
  keywords: string[];
  saltMap: Record<string, string>;
  adminUuid: string;
  isVisible: boolean;
  highlightedKeywordId: string | null;
  onKeywordHover: (keywordId: string | null) => void;
  onKeywordClick: (keywordId: string) => void;
};
