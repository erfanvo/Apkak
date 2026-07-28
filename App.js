import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, Text, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';

const App = () => {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  
  // به جای آدرس سایت، کل صفحه واسط را در این متغیر ذخیره می‌کنیم
  const [htmlContent, setHtmlContent] = useState('');
  const webviewRef = useRef(null);

  const handleInject = async () => {
    if (!link) {
      setStatus('❌ لطفاً لینک را وارد کنید.');
      return;
    }

    setIsInjecting(true);
    setStatus('⏳ در حال دریافت فایل JSON...');
    setHtmlContent('');

    try {
      const response = await fetch(link);
      const data = await response.json();

      if (!data || (!data.origins && !data.cookies)) {
        throw new Error('ساختار داده نامعتبر است.');
      }

      setStatus('⏳ در حال ساخت تونل امن ورود...');

      // استخراج کوکی‌ها
      let cookies = [];
      if (data.cookies) {
          cookies = data.cookies;
      } else {
          const ls = data.origins?.[0]?.localStorage || [];
          const t = ls.find(x => x.name === 'tokenMS')?.value;
          const r = ls.find(x => x.name === 'refresh_token')?.value;
          if(t) cookies.push({name: 'tokenMS', value: t});
          if(r) cookies.push({name: 'refresh_token', value: r});
      }

      // استخراج حافظه محلی
      const lsItems = data.origins?.[0]?.localStorage || [];

      // ساخت یک صفحه HTML اختصاصی که خودش وظیفه تزریق را بر عهده دارد
      const injectionHtml = `
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { background-color: #f9f9f9; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Tahoma, sans-serif; margin: 0; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #d81b60; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            p { margin-top: 15px; font-weight: bold; color: #555; }
            .container { text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
             <div class="loader" style="margin: 0 auto;"></div>
             <p>در حال همگام‌سازی اکانت...</p>
          </div>
          <script>
            try {
              // ۱. پاکسازی کامل مرورگر
              window.localStorage.clear();
              window.sessionStorage.clear();

              // ۲. تزریق امن کوکی‌ها مستقیماً در مرورگر
              var cookiesData = ${JSON.stringify(cookies)};
              for (var i = 0; i < cookiesData.length; i++) {
                 var c = cookiesData[i];
                 document.cookie = c.name + "=" + c.value + "; domain=.okala.com; path=/; secure;";
              }

              // ۳. تزریق امن دیتای پیچیده بدون خطای سینتکس
              var lsData = ${JSON.stringify(lsItems)};
              for (var j = 0; j < lsData.length; j++) {
                 window.localStorage.setItem(lsData[j].name, lsData[j].value);
              }

              // ۴. شلیک مستقیم به سایت مقصد (با این روش سایت اکالا متوجه هیچ تزریقی نمی‌شود)
              setTimeout(function() {
                 window.location.replace("https://www.okala.com/profile");
              }, 600);

            } catch(e) {
              document.body.innerHTML = "خطا در سیستم انتقال: " + e.message;
            }
          </script>
        </body>
        </html>
      `;

      // لود کردن صفحه ساخته شده در وب‌ویو
      setHtmlContent(injectionHtml);
      setIsInjecting(false);
      setStatus('');

    } catch (error) {
      setStatus('❌ خطا: ' + error.message);
      setIsInjecting(false);
    }
  };

  const closeWebView = () => {
    setHtmlContent('');
    setLink('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {!htmlContent ? (
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
            <View style={{width: 50}} />
          </View>

          <WebView
            ref={webviewRef}
            // کلید طلایی اینجاست: ما کدهای HTML خودمان را به عنوان سایت اصلی جا می‌زنیم
            source={{ html: htmlContent, baseUrl: 'https://www.okala.com/' }}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
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
