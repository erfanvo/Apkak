import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: HyperLinkScreen(),
  ));
}

class HyperLinkScreen extends StatefulWidget {
  const HyperLinkScreen({Key? key}) : super(key: key);

  @override
  _HyperLinkScreenState createState() => _HyperLinkScreenState();
}

class _HyperLinkScreenState extends State<HyperLinkScreen> {
  final TextEditingController _linkController = TextEditingController();
  bool _isProcessing = false;
  String _statusMessage = '';

  Future<void> _initializeConnection() async {
    final String endpointUrl = _linkController.text.trim();
    
    if (endpointUrl.isEmpty) {
      setState(() => _statusMessage = 'لطفاً لینک را وارد کنید.');
      return;
    }

    setState(() {
      _isProcessing = true;
      _statusMessage = 'در حال دریافت اطلاعات از سرور...';
    });

    try {
      final response = await http.get(Uri.parse(endpointUrl));
      if (response.statusCode != 200) {
        throw Exception('لینک نامعتبر است یا منقضی شده.');
      }
      
      final Map<String, dynamic> data = json.decode(response.body);

      setState(() => _statusMessage = 'در حال همگام‌سازی کوکی‌ها...');

      final CookieManager cookieManager = CookieManager.instance();
      await cookieManager.deleteAllCookies();

      // استخراج قطعی و بدون خطای تایپ (Type Error) برای LocalStorage
      List<dynamic> localData = [];
      if (data['origins'] != null && data['origins'] is List && (data['origins'] as List).isNotEmpty) {
        List<dynamic> originsList = data['origins'];
        dynamic matchedOrigin = originsList[0]; // پیش‌فرض
        
        // پیدا کردن ایمنِ اریجین اکالا
        for (var o in originsList) {
          if (o is Map && o['origin'] != null && o['origin'].toString().contains('okala.com')) {
            matchedOrigin = o;
            break;
          }
        }
        
        if (matchedOrigin is Map && matchedOrigin['localStorage'] != null) {
          localData = matchedOrigin['localStorage'];
        }
      }

      // تزریق دقیق کوکی‌ها با پارامترهای ایمنِ مرورگر
      List<dynamic> cookies = data['cookies'] ?? [];
      for (var c in cookies) {
        String domain = c['domain'] ?? ".okala.com";
        await cookieManager.setCookie(
          url: WebUri("https://www.okala.com"),
          name: c['name'],
          value: c['value'],
          domain: domain,
          path: c['path'] ?? "/",
          isSecure: c['secure'] ?? true,
          sameSite: HTTPCookieSameSitePolicy.NONE,
        );
      }

      setState(() => _statusMessage = 'آماده‌سازی مرورگر امن...');

      if (!mounted) return;
      
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SecureBrowserScreen(localData: localData),
        ),
      ).then((_) {
        setState(() {
          _isProcessing = false;
          _statusMessage = '';
          _linkController.clear();
        });
      });

    } catch (e) {
      setState(() {
        _statusMessage = 'خطا: ${e.toString()}';
        _isProcessing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F8),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Container(
            padding: const EdgeInsets.all(32.0),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16.0),
              boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 20, offset: Offset(0, 8))],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.security_rounded, color: Colors.indigo, size: 48),
                const SizedBox(height: 16),
                const Text('HyperLink Workspace', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                TextField(
                  controller: _linkController,
                  decoration: InputDecoration(
                    hintText: 'Enter Endpoint URL...',
                    filled: true,
                    fillColor: Colors.grey.shade50,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                    onPressed: _isProcessing ? null : _initializeConnection,
                    child: _isProcessing
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Initialize Connection', style: TextStyle(color: Colors.white, fontSize: 16)),
                  ),
                ),
                if (_statusMessage.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(_statusMessage, style: TextStyle(color: _statusMessage.contains('خطا') ? Colors.red : Colors.green, fontWeight: FontWeight.w500), textAlign: TextAlign.center),
                ]
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class SecureBrowserScreen extends StatefulWidget {
  final List<dynamic> localData;

  const SecureBrowserScreen({Key? key, required this.localData}) : super(key: key);

  @override
  State<SecureBrowserScreen> createState() => _SecureBrowserScreenState();
}

class _SecureBrowserScreenState extends State<SecureBrowserScreen> {
  bool _isInjecting = true;
  bool _hasInjectedData = false;

  @override
  Widget build(BuildContext context) {
    // کدگذاری داده‌ها برای جلوگیری از تداخل رشته‌های جاوااسکریپت
    final String base64Data = base64Encode(utf8.encode(jsonEncode(widget.localData)));

    // رفرش کردن همان صفحه اصلی به جای رفتن به پروفایل (دقیقاً مشابه اکستنشن کروم)
    final String injectionJs = """
      try {
        var decodedData = decodeURIComponent(escape(window.atob('$base64Data')));
        var items = JSON.parse(decodedData);
        localStorage.clear();
        sessionStorage.clear();
        items.forEach(item => {
          localStorage.setItem(item.name, item.value);
        });
        
        // رفرش صفحه برای هیدراته شدن سایت اکالا بدون فریز
        window.location.replace('https://www.okala.com/');
      } catch(e) {
        console.error("Storage Error:", e);
      }
    """;

    return Scaffold(
      appBar: AppBar(
        title: const Text('HyperLink Secure Browser', style: TextStyle(color: Colors.white, fontSize: 16)),
        backgroundColor: Colors.indigo,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Stack(
        children: [
          InAppWebView(
            initialUrlRequest: URLRequest(url: WebUri("https://www.okala.com/")),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              domStorageEnabled: true,
              thirdPartyCookiesEnabled: true,
              clearCache: false,
            ),
            onLoadStop: (controller, url) async {
              // مرحله اول: سایت لود شده، زمان تزریق دیتا و رفرش است
              if (!_hasInjectedData) {
                _hasInjectedData = true; 
                await controller.evaluateJavascript(source: injectionJs);
              } 
              // مرحله دوم: سایت با دیتای جدید روی ریشه رفرش شده، پس پرده لودینگ برداشته شود
              else {
                setState(() {
                  _isInjecting = false;
                });
              }
            },
          ),
          
          // نمایش لودینگ تا پایان عملیات رفرشِ پشت صحنه
          if (_isInjecting)
            Container(
              color: Colors.white,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    CircularProgressIndicator(color: Colors.indigo),
                    SizedBox(height: 16),
                    Text('در حال انتقال امن...', style: TextStyle(color: Colors.indigo, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

