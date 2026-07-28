import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, Text, ActivityIndicator, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';

const App = () => {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const [loadWebView, setLoadWebView] = useState(false);
  const [injectedJS, setInjectedJS] = useState('');
  const webviewRef = useRef(null);

  const handleInject = async () => {
    if (!link) {
      setStatus('❌ لطفاً لینک را وارد کنید.');
      return;
    }

    setIsInjecting(true);
    setStatus('⏳ در حال تحلیل ساختار JSON ربات...');
    setLoadWebView(false);

    try {
      const response = await fetch(link);
      const data = await response.json();

      if (!data || (!data.origins && !data.cookies)) {
        throw new Error('ساختار داده نامعتبر است.');
      }

      setStatus('⏳ در حال تزریق بومی کوکی‌ها در شبکه اندروید...');

      // ۱. پاکسازی کامل کوکی‌های پیشین سیستم‌عامل
      await CookieManager.clearAll();

      const lsItems = (data.origins && data.origins.length > 0 && data.origins[0].localStorage) ? data.origins[0].localStorage : [];

      // ۲. استخراج و تزریق هوشمند کوکی‌ها بر اساس فایل جدید
      if (data.cookies && data.cookies.length > 0) {
          for (let cookie of data.cookies) {
              await CookieManager.set('https://www.okala.com', {
                  name: cookie.name,
                  value: cookie.value,
                  domain: cookie.domain || '.okala.com',
                  path: cookie.path || '/',
                  secure: true,
              });
          }
      } else {
          // در فایلی که فرستادید، آرایه کوکی وجود ندارد و توکن‌ها باید از داخل لوکال استوریج استخراج و تبدیل به کوکی شوند
          const t = lsItems.find(x => x.name === 'tokenMS')?.value;
          const r = lsItems.find(x => x.name === 'refresh_token')?.value;

          if (t) {
              await CookieManager.set('https://www.okala.com', {
                  name: 'tokenMS', value: t, domain: '.okala.com', path: '/', secure: true
              });
          }
          if (r) {
              await CookieManager.set('https://www.okala.com', {
                  name: 'refresh_token', value: r, domain: '.okala.com', path: '/', secure: true
              });
          }
      }

      // اجبار سیستم‌عامل اندروید به ثبت فوری کوکی‌ها قبل از باز شدن مرورگر
      if (Platform.OS === 'android') {
          await CookieManager.flush();
      }

      // ۳. کلید طلایی: تبدیل امن آبجکت به رشته برای جلوگیری از خطای نگارشی (سینتکس) جاوااسکریپت در مرورگر
      const safeLsData = JSON.stringify(lsItems);

      const jsCode = `
        try {
          var items = ${safeLsData};
          window.localStorage.clear();
          window.sessionStorage.clear();
          
          for (var i = 0; i < items.length; i++) {
            window.localStorage.setItem(items[i].name, items[i].value);
          }
        } catch(e) {
          console.error("LS Error", e);
        }
        true;
      `;
      
      setInjectedJS(jsCode);
      setStatus('✅ اطلاعات با موفقیت پردازش شد...');
      
      // باز کردن مستقیم صفحه پروفایل پس از آماده‌سازی داده‌ها
      setTimeout(() => {
        setLoadWebView(true);
        setIsInjecting(false);
        setStatus('');
      }, 800);

    } catch (error) {
      setStatus('❌ خطا: ' + error.message);
      setIsInjecting(false);
    }
  };

  const closeWebView = () => {
    setLoadWebView(false);
    setLink('');
  };

  const reloadWebView = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {!loadWebView ? (
        <View style={styles.centerWrapper}>
          <View style={styles.card}>
            <View style={styles.iconPlaceholder}>
              <Text style={styles.iconText}>🔗</Text>
            </View>
            <Text style={styles.title}>تزریق‌گر هوشمند اکالا</Text>
            
            <TextInput
              style={styles.input}
              placeholder="لینک دسترسی را وارد نمایید..."
              placeholderTextColor="#95a5a6"
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TouchableOpacity 
              style={[styles.button, isInjecting && styles.buttonDisabled]} 
              onPress={handleInject} 
              disabled={isInjecting}
            >
              {isInjecting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>ورود به اکانت</Text>
              )}
            </TouchableOpacity>
            
            {status !== '' && (
              <Text style={[styles.statusText, status.includes('خطا') ? styles.errorText : styles.successText]}>
                {status}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.webviewContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={closeWebView} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>✕ خروج</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>مرورگر اکالا</Text>
            <TouchableOpacity onPress={reloadWebView} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>↻ رفرش</Text>
            </TouchableOpacity>
          </View>

          <WebView
            ref={webviewRef}
            // لود سایت واقعی برای انتقال بدون قطعی کوکی‌ها و استوریج
            source={{ uri: 'https://www.okala.com/profile' }}
            // این دستور محتوای استوریج را قبل از بالا آمدن سایت اکالا در سیستم می‌نشاند
            injectedJavaScriptBeforeContentLoaded={injectedJS}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            cacheEnabled={false}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  centerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    backgroundColor: '#ffffff',
    width: '100%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    alignItems: 'center',
  },
  iconPlaceholder: { width: 60, height: 60, backgroundColor: '#fce4ec', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconText: { fontSize: 28 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#d81b60', marginBottom: 24 },
  input: {
    width: '100%', backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ccc', borderRadius: 5,
    padding: 12, fontSize: 14, color: '#333', marginBottom: 20, textAlign: 'left'
  },
  button: {
    width: '100%', backgroundColor: '#d81b60', paddingVertical: 14, borderRadius: 5,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row'
  },
  buttonDisabled: { backgroundColor: '#ad1450' },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  statusText: { marginTop: 16, fontSize: 13, textAlign: 'center', fontWeight: 'bold' },
  errorText: { color: 'red' },
  successText: { color: 'green' },
  
  webviewContainer: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff', paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#ecf0f1', elevation: 2,
  },
  headerTitle: { color: '#d81b60', fontSize: 16, fontWeight: 'bold' },
  headerButton: { padding: 8, backgroundColor: '#f8f9fa', borderRadius: 8 },
  headerButtonText: { color: '#333', fontSize: 13, fontWeight: 'bold' },
});

export default App;
