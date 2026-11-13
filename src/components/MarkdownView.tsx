import Markdown from 'react-native-markdown-display';

import { colors, typography } from '@/constants/theme';

export function MarkdownView({ children }: { children: string }) {
  return (
    <Markdown
      style={{
        body: { color: colors.text, ...typography.body, lineHeight: 23 },
        heading1: { color: colors.text, ...typography.title, marginTop: 16, marginBottom: 8 },
        heading2: { color: colors.text, ...typography.heading, marginTop: 14, marginBottom: 6 },
        heading3: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
        paragraph: { marginTop: 4, marginBottom: 10 },
        bullet_list: { marginVertical: 6 },
        ordered_list: { marginVertical: 6 },
        list_item: { marginVertical: 3 },
        link: { color: colors.primaryDark, textDecorationLine: 'underline' },
        blockquote: { borderLeftColor: colors.primary, backgroundColor: colors.primaryLight },
        code_inline: { color: colors.primaryDark, backgroundColor: colors.primaryLight },
      }}
    >
      {children}
    </Markdown>
  );
}
