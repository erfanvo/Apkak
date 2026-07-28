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
      _statusMessage = 'در حال دریافت اطلاعات...';
    });

    try {
      final response = await http.get(Uri.parse(endpointUrl));
      if (response.statusCode != 200) throw Exception('خطا در دریافت لینک.');
      
      final Map<String, dynamic> data = json.decode(response.body);

      setState(() => _statusMessage = 'در حال تنظیم کوکی‌ها...');

      final CookieManager cookieManager = CookieManager.instance();
      await cookieManager.deleteAllCookies();

      // ۱. استخراج امن LocalStorage
      List<dynamic> localData = [];
      if (data['origins'] != null && (data['origins'] as List).isNotEmpty) {
        var originsList = data['origins'] as List;
        var matchedOrigin = originsList.firstWhere(
          (o) => o['origin'] != null && o['origin'].toString().contains('okala.com'),
          orElse: () => originsList[0],
        );
        localData = matchedOrigin['localStorage'] ?? [];
      }

      // ۲. تزریق کوکی‌ها (دقیقاً مثل اکستنشن با sameSite: None)
      List<dynamic> cookies = data['cookies'] ?? [];
      for (var c in cookies) {
        await cookieManager.setCookie(
          url: WebUri("https://www.okala.com"),
          name: c['name'],
          value: c['value'],
          domain: c['domain'] ?? ".okala.com",
          path: c['path'] ?? "/",
          isSecure: true,
          sameSite: HTTPCookieSameSitePolicy.NONE,
        );
      }

      setState(() => _statusMessage = 'آماده‌سازی مرورگر...');

      if (!mounted) return;
      
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => SecureBrowserScreen(localData: localData)),
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
                  Text(_statusMessage, style: TextStyle(color: Colors.green, fontWeight: FontWeight.w500), textAlign: TextAlign.center),
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
    // تبدیل دیتا برای جلوگیری از خرابی کاراکترها
    final String base64Data = base64Encode(utf8.encode(jsonEncode(widget.localData)));

    // این دقیقاً همان اسکریپت جاوااسکریپت اکستنشن شماست
    final String injectionJs = """
      try {
        var decodedData = decodeURIComponent(escape(window.atob('$base64Data')));
        var items = JSON.parse(decodedData);
        localStorage.clear();
        sessionStorage.clear();
        items.forEach(item => {
          localStorage.setItem(item.name, item.value);
        });
        // انتقال به پروفایل دقیقاً مثل اکستنشن
        window.location.replace('https://www.okala.com/profile');
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
            // اول به صورت مخفیانه ریشه سایت رو باز می‌کنیم تا کش و کوکی‌ها جا بیفتن
            initialUrlRequest: URLRequest(url: WebUri("https://www.okala.com/")),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              domStorageEnabled: true,
              thirdPartyCookiesEnabled: true,
            ),
            onLoadStop: (controller, url) async {
              String currentUrl = url.toString();
              
              // مرحله اول: سایت لود شده، حالا وقت تزریق دیتا و رفرش کردنه
              if (!_hasInjectedData && currentUrl.contains("okala.com")) {
                _hasInjectedData = true; // جلوگیری از لوپ بی‌نهایت
                await controller.evaluateJavascript(source: injectionJs);
              } 
              // مرحله دوم: سایت رفرش شده و روی پروفایل لود شده، پس صفحه رو نمایش بده
              else if (_hasInjectedData && currentUrl.contains("profile")) {
                setState(() {
                  _isInjecting = false;
                });
              }
            },
          ),
          
          // پرده لودینگ تا زمانی که پروسه تزریق و رفرش تموم نشده باشه
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

