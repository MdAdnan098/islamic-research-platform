// Ground truth for the word matching: five paragraphs, each written word-group by word-group in Roman Urdu | Urdu | Hindi.
// A group is "the same words" in the three scripts (some groups have a different number of words per script on purpose:
// "zer-e-behas" = 3 / 2 / 3 words, "dekh kar" = 2 / 2 / 1, "iski" = 1 / 2 / 1, "rahimahullah" = 1 / 2 / 1 ...).
const P = (s) => s.trim().split("\n").map((l) => l.split("|").map((x) => x.trim()));
export const PARAGRAPHS = [
P(`
Rafa yadain|رفع الیدین|रफ़ा यदैन
ka|کا|का
masla|مسئلہ|मसला
sahaba kiraam|صحابہ کرام|सहाबा किराम
ke|کے|के
zamaane|زمانے|ज़माने
se|سے|से
ulama|علماء|उलमा
ke|کے|के
darmiyan|درمیان|दरमियान
zer-e-behas|زیر بحث|ज़ेर-ए-बहस
raha|رہا|रहा
hai.|ہے۔|है।
Ahle hadis|اہل حدیث|अहले हदीस
is|اس|इस
amal|عمل|अमल
ko|کو|को
sunnat|سنت|सुन्नत
se|سے|से
sabit|ثابت|साबित
mante|مانتے|मानते
hain|ہیں|हैं
jabke|جبکہ|जबकि
doosre|دوسرے|दूसरे
ulama|علماء|उलमा
iski|اس کی|इसकी
alag|الگ|अलग
tashreeh|تشریح|तशरीह
karte|کرتے|करते
hain.|ہیں۔|हैं।
`),
P(`
Taqleed|تقلید|तक़लीद
ka|کا|का
matlab|مطلب|मतलब
hai|ہے|है
kisi|کسی|किसी
ki|کی|की
baat|بات|बात
ko|کو|को
bina|بغیر|बिना
dalil|دلیل|दलील
ke|کے|के
maan lena.|مان لینا۔|मान लेना।
Ittiba|اتباع|इत्तिबा
ka|کا|का
matlab|مطلب|मतलब
hai|ہے|है
dalil|دلیل|दलील
dekh kar|دیکھ کر|देखकर
uski|اس کی|उसकी
pairwi|پیروی|पैरवी
karna.|کرنا۔|करना।
In dono|ان دونوں|इन दोनों
mein|میں|में
bunyadi|بنیادی|बुनियादी
farq|فرق|फ़र्क़
yahi|یہی|यही
hai|ہے|है
ke|کہ|कि
ittiba|اتباع|इत्तिबा
mein|میں|में
insan|انسان|इंसान
Quran|قرآن|क़ुरआन
aur|اور|और
sahih|صحیح|सहीह
hadees|حدیث|हदीस
ko|کو|को
apna|اپنا|अपना
maakhaz|ماخذ|माख़ज़
banata|بناتا|बनाता
hai.|ہے۔|है।
`),
P(`
Wasila|وسیلہ|वसीला
ka|کا|का
matlab|مطلب|मतलब
hai|ہے|है
Allah|اللہ|अल्लाह
ki|کی|की
qurbat|قربت|क़ुर्बत
hasil|حاصل|हासिल
karne|کرنے|करने
ka|کا|का
zariya.|ذریعہ۔|ज़रिया।
Quran o hadees|قرآن و حدیث|क़ुरआन व हदीस
ke|کے|के
mutabiq|مطابق|मुताबिक़
nek|نیک|नेक
amal|عمل|अमल
aur|اور|और
zinda|زندہ|ज़िंदा
nek|نیک|नेक
insan|انسان|इंसान
ki|کی|की
dua|دعا|दुआ
ka|کا|का
wasila|وسیلہ|वसीला
jayaz|جائز|जाइज़
hai.|ہے۔|है।
Ilm-e-Ghaib|علم غیب|इल्म-ए-ग़ैब
sirf|صرف|सिर्फ़
Allah|اللہ|अल्लाह
ke|کے|के
paas|پاس|पास
hai,|ہے،|है,
is liye|اس لیے|इस लिए
is|اس|इस
mein|میں|में
kisi|کسی|किसी
ko|کو|को
shareek|شریک|शरीक
nahi|نہیں|नहीं
karna|کرنا|करना
chahiye.|چاہیے۔|चाहिए।
`),
P(`
Tarawih|تراویح|तरावीह
ki|کی|की
rakaton|رکعتوں|रकअतों
ki|کی|की
tadad|تعداد|तादाद
ke baare mein|کے بارے میں|के बारे में
ulama|علماء|उलमा
ki|کی|की
alag alag|الگ الگ|अलग अलग
rayein|رائیں|राएँ
hain.|ہیں۔|हैं।
Sahih Bukhari|صحیح بخاری|सहीह बुख़ारी
ki|کی|की
riwayat|روایت|रिवायत
mein|میں|में
Aisha radiyallahu anha|عائشہ رضی اللہ عنہا|आयशा रज़ियल्लाहु अन्हा
se|سے|से
gyarah|گیارہ|ग्यारह
rakaat|رکعات|रकअत
ka|کا|का
zikr|ذکر|ज़िक्र
milta|ملتا|मिलता
hai.|ہے۔|है।
Doosri taraf|دوسری طرف|दूसरी तरफ़
bees|بیس|बीस
rakaat|رکعات|रकअत
par|پر|पर
amal|عمل|अमल
karne wale|کرنے والے|करने वाले
bhi|بھی|भी
bade|بڑے|बड़े
ulama|علماء|उलमा
ke|کے|के
aqwal|اقوال|अक़वाल
pesh|پیش|पेश
karte|کرتے|करते
hain.|ہیں۔|हैं।
`),
P(`
Imam Abu Hanifa|امام ابو حنیفہ|इमाम अबू हनीफ़ा
rahimahullah|رحمہ اللہ|रहिमहुल्लाह
ne|نے|ने
fiqh|فقہ|फ़िक़्ह
ki|کی|की
bunyad|بنیاد|बुनियाद
Quran,|قرآن،|क़ुरआन,
sunnat|سنت|सुन्नत
aur|اور|और
sahaba|صحابہ|सहाबा
ke|کے|के
aqwal|اقوال|अक़वाल
par|پر|पर
rakhi.|رکھی۔|रखी।
Unke|ان کے|उनके
shagird|شاگرد|शागिर्द
Imam Abu Yusuf|امام ابو یوسف|इमाम अबू यूसुफ़
aur|اور|और
Imam Muhammad|امام محمد|इमाम मुहम्मद
ne|نے|ने
un ke|ان کے|उनके
ilm|علم|इल्म
ko|کو|को
aage|آگے|आगे
barhaya.|بڑھایا۔|बढ़ाया।
Aaj|آج|आज
bhi|بھی|भी
duniya|دنیا|दुनिया
ke|کے|के
bohat se|بہت سے|बहुत से
musalman|مسلمان|मुसलमान
unke|ان کے|उनके
tareeqe|طریقے|तरीक़े
par|پر|पर
amal|عمل|अमल
karte|کرتے|करते
hain.|ہیں۔|हैं।
`),
];

export const LANGS = ["en", "hi", "ur"];
const COL = { en: 0, ur: 1, hi: 2 };
/**
 * { text: {en, hi, ur}, groups: [{ en?: [s, e], hi?: [s, e], ur?: [s, e] }] } - the three texts and where every group sits in each.
 * `par` is a list of rows [ro, ur, hi]; an empty cell = that script has no such group. `order[lang]` = the order of the groups in that
 * script's text (default: as listed).
 */
export function build(par, order = {}) {
  const text = { en: "", hi: "", ur: "" };
  const groups = par.map(() => ({}));
  for (const l of LANGS) {
    for (const i of order[l] || par.map((_, k) => k)) {
      const piece = par[i][COL[l]];
      if (!piece) continue;
      if (text[l]) text[l] += " ";
      groups[i][l] = [text[l].length, text[l].length + piece.length];
      text[l] += piece;
    }
  }
  return { text, groups };
}
