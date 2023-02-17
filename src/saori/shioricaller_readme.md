shioricaller
===================

![build](https://github.com/Narazaka/shioricaller/workflows/build/badge.svg)

    shioricaller shiori.dll dirpath < request.txt > response.txt

ダウンロード
-------------------

[Releases](https://github.com/Narazaka/shioricaller/releases) からどうぞ

これは何か？
-------------------

shioricallerは[SHIORI DLL](http://usada.sakura.vg/contents/specification2.html#shioriwindows)規格に基づいたload(), request(), unload()の呼び出しを行います。

1. 第一引数の名前のshiori.dllを使う。
2. 第二引数を引数文字列としてload()を呼ぶ。
3. stdinに入力された文字列をSHIORIリクエスト単位で分割してrequest()を呼び、返却された文字列をstdoutに出力する。
4. unload()を呼ぶ。

何に使えるか？
-------------------

SHIORI DLL規格を満たすshiori.dllは、往々にして独自のスクリプト言語を持ちます。

華和梨、里々、YAYA、美坂や他の多くのshiori.dllはそれぞれ伺かのSHIORI用途のみで存在する独自言語を持っています。

それにもかかわらず、その言語の処理系をコマンドラインで提供するものは多くありません。
アプリケーションのデバッグは、言語記述によるものか、内容によるものかの切りわけが必要なのにこれでは不便きわまりません。

そこでshioricallerは、それらshiori.dllが処理する独自言語の、所謂「コマンドライン版」のような使用方法を提供します。

実例
-------------------

下記サンプルは[examples](examples)にファイルとしても存在します。

手っ取り早くテストしたい場合に便利です。

### YAYAの場合

YAYAには「コマンドライン版」がありませんが、以下のようにrequestに任意の処理を書くことによって、コマンドラインから「YAYA言語」の自由なテストが行えます(Windowsの場合)。

    1. C:\path\to\ に以下を配置
    --------------------
    - yaya.txt
    - test.dic
    - yaya.dll
    --------------------
    
    2. C:\path\to\yaya.txt に以下を記述
    --------------------
    dic, test.dic
    --------------------
    
    3. C:\path\to\test.dic に以下を記述
    --------------------
    request
    {
      "Hello YAYA world."
    }
    --------------------
    
    4. 以下のコマンドを実行
    shioricaller C:\path\to\yaya.dll C:\path\to\ < NUL

### 里々の場合

里々にも「コマンドライン版」がありませんが、以下のようにテスト用エントリに任意の処理を書くことによって、コマンドラインから「里々言語」の自由なテストが行えます(Windowsの場合)。

    1. C:\path\to\ に以下を配置
    --------------------
    - dictest.txt
    - satori.dll
    - request.txt
    --------------------
    
    2. C:\path\to\dictest.txt に以下を記述
    --------------------
    ＊OnTest
    こんにちは里々のセカイ
    --------------------
    
    3. C:\path\to\request.txt に以下を記述(改行は2回入れてください)
    --------------------
    GET SHIORI/3.0
    ID: OnTest
    
    
    --------------------
    
    4. 以下のコマンドを実行
    shioricaller C:\path\to\satori.dll C:\path\to\ < request.txt

### 美坂の場合

美坂にも「コマンドライン版」がありませんが、以下のようにテスト用エントリに任意の処理を書くことによって、コマンドラインから「美坂言語」の自由なテストが行えます(Windowsの場合)。

    1. C:\path\to\ に以下を配置
    --------------------
    - misaka.txt
    - misaka.ini
    - misaka.dll
    - request.txt
    --------------------
    
    2. C:\path\to\misaka.ini に以下を記述
    --------------------
    dictionaries
    {
    misaka.txt
    }
    --------------------
    
    3. C:\path\to\misaka.txt に以下を記述
    --------------------
    $OnTest
    Hello misaka world.
    --------------------
    
    4. C:\path\to\request.txt に以下を記述(改行は2回入れてください)
    --------------------
    GET SHIORI/3.0
    ID: OnTest
    
    
    --------------------
    
    5. 以下のコマンドを実行
    shioricaller C:\path\to\misaka.dll C:\path\to\ < request.txt

### 華和梨の場合

華和梨には「コマンドライン版」である「幸水」がありますが、shioricallerでも以下の方法で一応テスト可能です(Windowsの場合)。

    1. C:\path\to\ に以下を配置
    --------------------
    - kawarirc.kis
    - shiori.dll
    - request.txt
    --------------------
    
    2. C:\path\to\kawarirc.kis に以下を記述
    --------------------
    System.Callback.OnGET: (Hello KAWARI world.)
    --------------------
    
    3. C:\path\to\request.txt に以下を記述(改行は2回入れてください)
    --------------------
    GET SHIORI/3.0
    ID: OnTest
    
    
    --------------------
    
    4. 以下のコマンドを実行
    shioricaller C:\path\to\shiori.dll C:\path\to\ < request.txt

複数のリクエスト
--------------------------

以下のような連続したリクエストは有効です。空行の`[改行]`が渡った時点でレスポンスが返ってきて、合計2レスポンスが返ります。

```
GET SHIORI/3.0[改行]
ID: version[改行]
[改行]
GET SHIORI/3.0[改行]
ID: OnTest[改行]
[改行]
```

ライセンス
--------------------------

[Zlibライセンス](LICENSE)の元で配布いたします。
