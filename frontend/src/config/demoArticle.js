/**
 * Sample research article for offline viewing and visual testing of
 * typography, multi-script translations, and font size adjustment.
 */
export const DEMO_ARTICLE_PAYLOAD = {
  article: {
    id: "sample",
    slug: "demo",
    title: "Tawheed aur Aqeedah-e-Salaf: Bunyaadi Usul aur Ahmiyat",
    titleTr: {
      hi: "तौहीद और अक़ीदा-ए-सलफ़: बुनियादी उसूल और अहमियत",
      ur: "توحید اور عقیدہ سلف: بنیادی اصول اور اہمیت",
      en: "Tawheed aur Aqeedah-e-Salaf: Bunyaadi Usul aur Ahmiyat",
    },
    language: "ur",
    status: "published",
    publishedAt: new Date().toISOString(),
    excerpt:
      "Islam ki dawat ka sab se pehla aur azeem tareen rukan Tawheed hai. Is mazmoon mein aqeedah-e-salaf ki roshni mein uske bunyaadi dalail bayan kiye gaye hain.",
    blocks: [
      {
        id: "b1",
        type: "heading",
        level: 2,
        text: "Tawheed ki Haqeeqat aur Ahmiyat",
        tr: {
          hi: "तौहीद की हक़ीक़त और अहमियत",
          ur: "توحید کی حقیقت اور اہمیت",
        },
      },
      {
        id: "b2",
        type: "quote",
        kind: "ayat",
        text: "وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ",
        source: "Surah Adh-Dhariyat (51:56)",
      },
      {
        id: "b3",
        type: "text",
        text: "Aur main ne jinnaat aur insano ko sirf isi liye paida kiya hai ke woh meri ibadat karein.\n\nIs aayat-e-kareema se wazeh hota hai ke insaani zindagi ka maqsad-e-takhleeq sirf aur sirf Allah Ta'ala ki wahdaniyat aur uski khalis ibadat hai. Salaf-e-saliheen ne hamesha is bunyaadi usul par zor diya.",
        tr: {
          hi: "और मैंने जिन्नात और इंसानों को सिर्फ इसीलिए पैदा किया है कि वो मेरी इबादत करें।\n\nइस आयत-ए-करीमा से साफ़ ज़ाहिर होता है कि इंसानी ज़िंदगी का मक़सद-ए-तख़्लीक़ सिर्फ़ अल्लाह तआला की वहदानियत और उसकी ख़ालिस इबादत है।",
          ur: "اور میں نے جنات اور انسانوں کو صرف اسی لیے پیدا کیا ہے کہ وہ میری عبادت کریں۔\n\nاس آیت کریمہ سے واضح ہوتا ہے کہ انسانی زندگی کا مقصد تخلیق صرف اور صرف اللہ تعالیٰ کی وحدانیت اور اس کی خالص عبادت ہے۔ سلف صالحین نے ہمیشہ اسی بنیادی اصول پر زور دیا ہے۔",
        },
      },
      {
        id: "b4",
        type: "heading",
        level: 3,
        text: "Sunnat-e-Nabawi aur Salaf ka Manhaj",
        tr: {
          hi: "सुन्नत-ए-नबवी और सलफ़ का मन्हज",
          ur: "سنت نبوی اور سلف کا منہج",
        },
      },
      {
        id: "b5",
        type: "quote",
        kind: "hadith",
        text: "قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: عَلَيْكُمْ بِسُنَّتِي وَسُنَّةِ الْخُلَفَاءِ الرَّاشِدِينَ الْمَهْدِيِّينَ",
        source: "Sunan Abi Dawud (4607)",
      },
      {
        id: "b6",
        type: "text",
        text: "Rasoolullah ﷺ ne farmaya: 'Tum par meri sunnat aur hidayat-yafta khulafa-e-rashideen ka tareeqa lazim hai.'",
        tr: {
          hi: "रसूलुल्लाह ﷺ ने फ़रमाया: 'तुम पर मेरी सुन्नत और हिदायत-याफ़्ता खुलफ़ा-ए-राशिदीन का तरीक़ा लाज़िम है।'",
          ur: "رسول اللہ ﷺ نے فرمایا: 'تم پر میری سنت اور ہدایت یافتہ خلفائے راشدین کا طریقہ لازم ہے۔'",
        },
      },
      {
        id: "b7",
        type: "reference",
        referenceId: "ref1",
      },
      {
        id: "b8",
        type: "divider",
      },
      {
        id: "b9",
        type: "heading",
        level: 3,
        text: "Khatima aur Nateeja",
        tr: {
          hi: "निष्कर्ष",
          ur: "خاتمہ اور نتیجہ",
        },
      },
      {
        id: "b10",
        type: "text",
        text: "Sahih aqeedah hi aamaal ki qubooliyat ki shart-e-awwal hai. Jab aqeedah mein khot ya shirk aa jaye to saare nek aamaal zaaye ho jaate hain. Is liye har musalman par lazim hai ke woh Quran aur Sunnah ko salaf ke fehm ke mutabiq samjhe.",
        tr: {
          hi: "सही अक़ीदा ही आमाल की क़बूलियत की पहली शर्त है। जब अक़ीदे में शिर्क या ख़ोट आ जाए तो सारे नेक आमाल ज़ाया हो जाते हैं।",
          ur: "صحیح عقیدہ ہی اعمال کی قبولیت کی شرط اول ہے۔ جب عقیدہ میں کھوٹ یا شرک آ جائے تو سارے نیک اعمال ضائع ہو جاتے ہیں۔ اس لیے ہر مسلمان پر لازم ہے کہ وہ قرآن اور سنت کو سلف کے فہم کے مطابق سمجھے۔",
        },
      },
    ],
  },
  references: [
    {
      id: "ref1",
      book: "Kitab at-Tawheed",
      author: "Imam Muhammad bin Abdul Wahhab (Rahimahullah)",
      volume: "1",
      page: "12",
      referenceText:
        "Har musalman par farz hai ke woh sab se pehle Tawheed ki aqsaam (Rububiyyah, Uluhiyyah, Asma wa Sifat) ka fehm hasil kare.",
    },
  ],
  trail: {
    section: "aqaid",
    folders: [{ title: "Bunyaadi Aqeedah", slug: "bunyaadi-aqeedah" }],
  },
};
