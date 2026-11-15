import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors, radius } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { receiptHtml } from '@/lib/receipt/receiptHtml';
import type { ReceiptData, ReceiptLayout } from '@/lib/receipt/types';

export function ReceiptHtmlPreview({
  data,
  layout = 'compact',
  style,
}: {
  data: ReceiptData;
  layout?: ReceiptLayout;
  style?: StyleProp<ViewStyle>;
}) {
  const [height, setHeight] = useState(780);
  const html = useMemo(() => receiptHtml(data, {
    size: layout,
    fmt: (minor) => formatMoney(minor, data.business.currencyCode || 'SLE'),
  }), [data, layout]);
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const nextHeight = Number(event.nativeEvent.data);
    if (Number.isFinite(nextHeight) && nextHeight > 0) {
      setHeight(Math.min(Math.ceil(nextHeight), 10000));
    }
  }, []);

  return (
    <View style={[styles.frame, style]}>
      <WebView
        source={{ html }}
        style={[styles.webView, { height }]}
        originWhitelist={['*']}
        scrollEnabled={false}
        javaScriptEnabled
        onMessage={onMessage}
        injectedJavaScript="(function(){var report=function(){window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight));};report();window.addEventListener('load',report);new ResizeObserver(report).observe(document.body);})();true;"
        accessibilityLabel="Receipt preview"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  webView: { width: '100%', backgroundColor: colors.white },
});
