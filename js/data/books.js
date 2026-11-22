'use strict';
(function (w) {
  const author = 'the_samsonpaul';
  const books = [
    {
      id: 'cookbook', slug: 'bachelor-99-survival-cookbook', title: 'Bachelor 99 Survival Cookbook',
      subtitle: '99 budget Indian recipes for everyday cooking', author, category: 'Self Care',
      tags: ['recipes', 'indian meals', 'budget cooking'], price: 99, mrp: 199, pages: 114,
      format: 'PDF', language: 'English', badges: ['bestseller'], releasedAt: '2024-01-10',
      cover: 'images/Ebook1.png',
      gallery: ['images/Ebook1.png', 'images/book1.png', 'images/book2.png', 'images/book3.png', 'images/book4.png', 'images/book5.png', 'images/book6.png', 'images/book7.png'],
      preview: ['images/image1.png', 'images/image2.png', 'images/image3.png'],
      description: '99 no-nonsense recipes built for bachelor budgets — affordable ingredients, simple equipment and meals that are easy to follow.',
      learn: ['No complicated cooking techniques — just food that works.', 'Meals designed around common, affordable ingredients.', 'Most recipes come together in 30 minutes or less.', 'Beginner-friendly steps for people who have never cooked a proper meal.', 'Clear instructions with no guesswork or jargon.', 'Familiar flavours, cooked the way home food should taste.'],
      chapters: [{ title: 'Quick meals', subtitle: 'Simple recipes for busy days' }, { title: 'Rice and one-pot meals', subtitle: 'Filling meals with minimal utensils' }, { title: 'Breakfast and quick bites', subtitle: 'Easy starts and snacks' }, { title: 'High-protein meals', subtitle: 'Everyday meal ideas' }, { title: 'Lunch and dinner', subtitle: 'Balanced home cooking' }, { title: 'Budget meals', subtitle: 'More from everyday ingredients' }],
      faq: [
        { q: 'The Survival Strategy', a: 'This cookbook brings together 99 practical Indian recipes for everyday cooking. Each one is designed around accessible ingredients and simple methods, so you can make satisfying meals without complicated equipment.' },
        { q: 'Device + Access', a: 'Open the cookbook from My Shelf on a phone, tablet or computer. Your reading position is saved to your BOOKIVO account.' },
        { q: 'Instant Delivery', a: 'After BOOKIVO confirms your payment, open My Shelf using the same account. Select the cookbook to start reading or return to a saved page.' },
        { q: 'Are the recipes beginner friendly?', a: 'Yes. The recipes use clear, step-by-step instructions and familiar ingredients to help new cooks feel comfortable in the kitchen.' }
      ],
      sampleUrl: 'BOOK-1/index.html#galleryMain', fileUrl: '', isReal: true,
      beforeAfter: { before: 'images/before.png', after: 'images/after.png' }
    },
    {
      id: 'road-to-5cr', slug: 'road-to-5cr', title: 'Road to 5Cr',
      subtitle: 'A 160-page educational money guide', author, category: 'Financials',
      tags: ['money', 'salary', 'investing basics', 'planning'], price: 299, mrp: 399, pages: 160,
      format: 'PDF', language: 'English', badges: ['new', 'bestseller'], releasedAt: '2025-10-15',
      cover: '', gallery: [], preview: [],
      description: 'An educational guide for salaried employees and students covering savings, investment concepts and illustrative planning examples.',
      learn: ['Understand common personal-finance concepts', 'Compare long-term saving and investing tools', 'Build an illustrative plan around income and age'],
      chapters: [{ title: 'The Salary Trap', subtitle: 'How income, spending and saving shape a plan' }, { title: 'The Tax Matrix', subtitle: 'An educational overview of tax concepts' }, { title: 'The Core Engine', subtitle: 'SIPs, index funds and ETFs' }, { title: 'The Accelerators', subtitle: 'EPF, VPF, PPF, NPS, gold and REITs' }, { title: 'The Wealth Shield', subtitle: 'Behaviour, market cycles and common planning mistakes' }, { title: 'The ₹5 Crore Execution Plan', subtitle: 'Illustrative roadmaps by income and age' }, { title: 'The ₹100 Crore Horizon', subtitle: 'Long-term growth and legacy concepts' }],
      faq: [
        { q: 'How long is the guide?', a: 'Road to 5Cr is a 160-page digital guide. Its chapters cover personal-finance concepts, common investment options and illustrative planning examples.' },
        { q: 'Does it include personal financial advice?', a: 'No. The guide is educational and its figures are illustrative, not individual investment, tax or legal advice. Consider a qualified professional before making decisions for your circumstances.' },
        { q: 'Can I use the Bookivo calculator with this guide?', a: 'The free SIP and wealth calculator is a separate interactive resource. It requires a Bookivo sign-in, and its projections are examples rather than guarantees of future returns.' }
      ],
      sampleUrl: '', fileUrl: '', isReal: true,
      disclaimer: 'Educational content only. Not investment or tax advice. Illustrative examples.'
    }
  ];
  const cookbook = books[0];
  const roadBook = books[1];
  const portraitBook = {
    id: 'book-2', slug: 'cinematic-portrait-prompts', title: 'Turn Your Photos Into Cinematic Masterpieces',
    subtitle: '25 Ready-to-Use AI Portrait Prompts for Girls', author, category: 'Self Growth',
    tags: ['AI prompts', 'portrait photography', 'creative prompts', 'cinematic portraits'], price: 25, mrp: 59, pages: 30,
    format: 'PDF', language: 'English', badges: ['new'], releasedAt: '2026-11-19', folder: 'BOOK-2',
    cover: 'BOOK-2/images/portrait-prompts-3d-cover.png',
    gallery: ['BOOK-2/images/portrait-prompts-3d-cover.png','BOOK-2/images/portrait-prompts-five-scenes.png','BOOK-2/images/portrait-prompts-alisa-pages.png','BOOK-2/images/portrait-prompts-flower-royal-pages.png','BOOK-2/images/portrait-prompts-three-page-preview.png'],
    preview: ['BOOK-2/images/portrait-prompts-alisa-pages.png','BOOK-2/images/portrait-prompts-flower-royal-pages.png','BOOK-2/images/portrait-prompts-three-page-preview.png'],
    description: 'From dreamy golden-hour portraits to luxury fashion, midnight aesthetics and stunning cinematic looks. This 30-page digital ebook includes 25 ready-to-use prompts you can copy and adapt for your creative portraits.',
    learn: ['Explore 25 ready-to-use AI portrait prompts for girls.','Create looks ranging from golden-hour portraits to cinematic midnight scenes.','Copy and adapt prompts for your own image-generation workflow.'],
    chapters: [{title:'Portrait styles',subtitle:'Golden-hour, luxury fashion and cinematic moods'},{title:'Prompt collection',subtitle:'25 ready-to-use prompts to copy and adapt'},{title:'How to use prompts',subtitle:'A simple visual walkthrough from the supplied pages'}],
    faq: [{q:'What is included in this ebook?',a:'This 30-page digital ebook includes 25 ready-to-use AI portrait prompts for girls. The prompts cover golden-hour portraits, luxury fashion, dramatic midnight aesthetics and other cinematic looks.'},{q:'How do I use the prompts?',a:'Copy a prompt and adapt its details to your preferred image-generation tool. Follow the visual guide included in the ebook, then adjust the scene, lighting and styling to suit your idea.'},{q:'What format is the ebook?',a:'Read the 30 pages inside BOOKIVO on a phone, tablet or computer. Open My Shelf after payment to resume reading and copy the prompts.'}],
    sampleUrl: '', fileUrl: '', isReal: true
  };
  const toolkitBook = {"id": "book-3", "slug": "ai-toolkit", "title": "The AI Toolkit: Turn Everyday Tasks into Done", "subtitle": "10 powerful free AI tools. One practical beginner\u2019s guide.", "author": "the_samsonpaul", "category": "Self Growth", "tags": ["AI", "productivity", "beginner", "tools", "workflows"], "price": 199, "mrp": 199, "pages": 38, "format": "Downloadable PDF", "language": "English", "badges": ["new"], "releasedAt": "2026-11-22", "folder": "BOOK-3", "cover": "BOOK-3/images/cover.png", "gallery": ["BOOK-3/images/hero.png", "BOOK-3/images/inside.png", "BOOK-3/images/journey.png", "BOOK-3/images/learn.png", "BOOK-3/images/beginners.png"], "preview": [], "description": "Go from \u201cwhere do I start?\u201d to your first useful AI project. This 38-page guide brings together ten tool walkthroughs, twelve reusable prompts, five practical workflows and a seven-day action plan.", "learn": ["Understand what each of ten AI tools can do and how to get started.", "Follow practical steps for summaries, visuals, content and small apps.", "Adapt twelve reusable prompts and combine tools into five workflows.", "Build a habit with a seven-day plan and learn about privacy, licences and free-plan limits."], "chapters": [{"title": "Start with confidence", "subtitle": "Before you start, five ground rules and a quick way to choose your first tool."}, {"title": "Ten guided tool walkthroughs", "subtitle": "Practical introductions and setup steps for learning, content creation and productivity."}, {"title": "Put the tools to work", "subtitle": "Five workflows, an at-a-glance comparison and twelve reusable prompts."}, {"title": "Build your own routine", "subtitle": "A seven-day action plan and realistic guidance about changing free plans."}], "faq": [{"q": "What will I receive?", "a": "A 38-page PDF ebook. Download it after successful payment or later from My Shelf."}, {"q": "Can I read this ebook inside BOOKIVO?", "a": "This title is download-only. Open the downloaded PDF in your preferred PDF reader."}, {"q": "Are the AI tools free forever?", "a": "No guarantee. The guide explains free plans and their limits; providers can change pricing, availability and usage terms."}], "sampleUrl": "", "fileUrl": "https://raw.githubusercontent.com/bookivo-official/book3/main/BOOKIVO-AI-Toolkit.pdf", "downloadOnly": true, "isReal": true};
  cookbook.folder = 'BOOK-1';
  const cookbookCopies = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    if (number === 1) return cookbook;
    if (number === 2) return portraitBook;
    if (number === 3) return toolkitBook;
    const copy = JSON.parse(JSON.stringify(cookbook));
    copy.id = `book-${number}`;
    copy.slug = `bachelor-99-survival-cookbook-${number}`;
    copy.folder = `BOOK-${number}`;
    return copy;
  });
  roadBook.catalog = false;
  books.splice(0, books.length, ...cookbookCopies, roadBook);
  w.Bookivo.Data = w.Bookivo.Data || {};
  w.Bookivo.Data.books = books;
})(window);
