const Article = require('../models/Article');

exports.getAllArticles = async (req, res) => {
    try {
        console.log('📄 Fetching all published articles...');
        
        const articles = await Article.find({ status: 'published' })
            .populate('author', 'username email role')
            .sort({ createdAt: -1 });

        console.log(`✅ Found ${articles.length} articles`);

        res.json({
            success: true,
            count: articles.length,
            articles
        });
    } catch (error) {
        console.error('❌ Get all articles error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

exports.getArticle = async (req, res) => {
    try {
        console.log('📄 Fetching article:', req.params.id);
        
        const article = await Article.findById(req.params.id)
            .populate('author', 'username email role');

        if (!article) {
            console.log('❌ Article not found:', req.params.id);
            return res.status(404).json({
                success: false,
                message: 'Article not found'
            });
        }

        console.log('✅ Article found:', article.title);

        res.json({
            success: true,
            article
        });
    } catch (error) {
        console.error('❌ Get article error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.createArticle = async (req, res) => {
    try {
        const { title, content, status = 'published' } = req.body;

        console.log('📝 Creating article for user:', req.user.email);

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Please provide title and content'
            });
        }

        const article = new Article({
            title,
            content,
            author: req.user._id,
            status
        });

        await article.save();
        await article.populate('author', 'username email');

        console.log('✅ Article created:', article.title);

        res.status(201).json({
            success: true,
            message: 'Article created successfully',
            article
        });
    } catch (error) {
        console.error('❌ Create article error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating article'
        });
    }
};

// ... fungsi lainnya tetap sama