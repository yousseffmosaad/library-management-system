const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const uploadDirectory = path.join(__dirname, 'uploads');
const imageExtensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

fs.mkdirSync(uploadDirectory, { recursive: true });
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDirectory));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const imageUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, callback) => callback(null, uploadDirectory),
        filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${imageExtensions[file.mimetype]}`)
    }),
    fileFilter: (_req, file, callback) => {
        if (!imageExtensions[file.mimetype]) {
            return callback(new Error('Choose a JPEG, PNG, WebP, or GIF image.'));
        }
        callback(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

function removeUploadedFile(file) {
    if (file) fs.unlink(file.path, () => {});
}

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456789',
    database: 'library_db'
});

const queryAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

function ensureImageColumn(table, column) {
    return new Promise((resolve, reject) => {
        db.query(`ALTER TABLE ${table} ADD COLUMN ${column} VARCHAR(255) NULL`, (err) => {
            if (err && err.code !== 'ER_DUP_FIELDNAME') return reject(err);
            resolve();
        });
    });
}

function startServer() {
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return startServer();
    }
    Promise.all([
        ensureImageColumn('AUTHOR', 'photo'),
        ensureImageColumn('BOOK', 'cover_image')
    ]).then(() => {
        console.log('Image columns are ready');
        startServer();
    }).catch((schemaError) => {
        console.error('Could not prepare image columns:', schemaError);
        startServer();
    });
});

app.get('/', (_req, res) => res.redirect('/login'));
app.get('/register', (_req, res) => res.render('register'));

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.query('INSERT INTO USERS (username, password) VALUES (?, ?)', [username, password], (err) => {
        if (err) return res.status(500).send('Error registering user: ' + err.message);
        res.redirect('/login');
    });
});

app.get('/login', (_req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM USERS WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err) return res.status(500).send('Database error: ' + err.message);
        if (results.length > 0) res.redirect('/dashboard');
        else res.status(401).send('Invalid username or password. <a href="/login">Try again</a>');
    });
});

app.get('/dashboard', async (req, res) => {
    try {
        const activeTab = req.query.tab || 'manage';
        const keyword = (req.query.keyword || '').trim();
        const minPrice = req.query.min_price !== undefined && req.query.min_price !== '' ? Number(req.query.min_price) : 0;
        const maxPrice = req.query.max_price !== undefined && req.query.max_price !== '' ? Number(req.query.max_price) : 999999;
        const categoryId = req.query.category_id || '';

        let searchSql = `
            SELECT b.*, a.name AS author_name, p.name AS publisher_name, c.name AS category_name
            FROM BOOK b
            LEFT JOIN AUTHOR a ON b.author_id = a.author_id
            LEFT JOIN PUBLISHER p ON b.publisher_id = p.publisher_id
            LEFT JOIN CATEGORY c ON b.category_id = c.category_id
            WHERE b.title LIKE ? AND b.price BETWEEN ? AND ?
        `;
        const searchParams = [`%${keyword}%`, minPrice, maxPrice];
        if (categoryId) {
            searchSql += ' AND b.category_id = ?';
            searchParams.push(categoryId);
        }
        searchSql += ' ORDER BY b.price ASC';

        const [
            books, authors, categories, searchResults, catalogue,
            categoryStats, prolificAuthors, librarySummary,
            activeLoans, inactiveMembers, unborrowedBooks,
            topBooks, topMember, authorCounts, sameCountryBooks
        ] = await Promise.all([
            queryAsync('SELECT * FROM BOOK'),
            queryAsync('SELECT * FROM AUTHOR'),
            queryAsync('SELECT * FROM CATEGORY'),
            queryAsync(searchSql, searchParams),
            queryAsync(`
                SELECT b.book_id, b.title, b.price, b.publish_year, b.cover_image,
                       a.name AS author_name, p.name AS publisher_name, c.name AS category_name
                FROM BOOK b
                LEFT JOIN AUTHOR a ON b.author_id = a.author_id
                LEFT JOIN PUBLISHER p ON b.publisher_id = p.publisher_id
                LEFT JOIN CATEGORY c ON b.category_id = c.category_id
                ORDER BY b.book_id ASC
            `),
            queryAsync(`
                SELECT c.name AS category_name, COUNT(b.book_id) AS book_count, ROUND(AVG(b.price), 2) AS avg_price
                FROM CATEGORY c LEFT JOIN BOOK b ON c.category_id = b.category_id
                GROUP BY c.category_id, c.name
            `),
            queryAsync(`
                SELECT a.author_id, a.name AS author_name, COUNT(b.book_id) AS book_count
                FROM AUTHOR a JOIN BOOK b ON a.author_id = b.author_id
                GROUP BY a.author_id, a.name HAVING COUNT(b.book_id) >= 2
            `),
            queryAsync('SELECT SUM(price) AS total_price, MIN(price) AS min_price, MAX(price) AS max_price FROM BOOK'),
            queryAsync(`
                SELECT l.loan_id, b.title AS book_title, m.name AS member_name, l.loan_date
                FROM LOAN l JOIN BOOK b ON l.book_id = b.book_id JOIN MEMBER m ON l.member_id = m.member_id
                WHERE l.return_date IS NULL
            `),
            queryAsync(`
                SELECT m.member_id, m.name, m.email, m.join_date
                FROM MEMBER m LEFT JOIN LOAN l ON m.member_id = l.member_id WHERE l.loan_id IS NULL
            `),
            queryAsync(`
                SELECT b.book_id, b.title, b.price, b.publish_year
                FROM BOOK b LEFT JOIN LOAN l ON b.book_id = l.book_id WHERE l.loan_id IS NULL
            `),
            queryAsync(`
                SELECT b.book_id, b.title, COUNT(l.loan_id) AS loan_count
                FROM BOOK b JOIN LOAN l ON b.book_id = l.book_id
                GROUP BY b.book_id, b.title ORDER BY loan_count DESC LIMIT 3
            `),
            queryAsync(`
                SELECT m.member_id, m.name, m.email, COUNT(l.loan_id) AS loan_count
                FROM MEMBER m JOIN LOAN l ON m.member_id = l.member_id
                GROUP BY m.member_id, m.name, m.email ORDER BY loan_count DESC LIMIT 1
            `),
            queryAsync(`
                SELECT a.author_id, a.name AS author_name, a.country, COUNT(b.book_id) AS book_count
                FROM AUTHOR a LEFT JOIN BOOK b ON a.author_id = b.author_id
                GROUP BY a.author_id, a.name, a.country
            `),
            queryAsync(`
                SELECT b.book_id, b.title, a.name AS author_name, p.name AS publisher_name, a.country
                FROM BOOK b JOIN AUTHOR a ON b.author_id = a.author_id JOIN PUBLISHER p ON b.publisher_id = p.publisher_id
                WHERE a.country = p.country
            `)
        ]);

        res.render('index', {
            activeTab, books, authors, categories, searchResults,
            filters: {
                keyword,
                min_price: req.query.min_price || '',
                max_price: req.query.max_price || '',
                category_id: categoryId
            },
            catalogue, categoryStats, prolificAuthors,
            summary: librarySummary[0] || { total_price: 0, min_price: 0, max_price: 0 },
            activeLoans, inactiveMembers, unborrowedBooks,
            topBooks, topMember: topMember[0] || null,
            authorCounts, sameCountryBooks
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).send('Database error: ' + err.message);
    }
});

app.get('/author/add', (_req, res) => res.render('add_author'));
app.get('/book/add', (_req, res) => {
    db.query('SELECT * FROM AUTHOR', (err, authors) => {
        if (err) return res.status(500).send('Database error: ' + err.message);
        res.render('add_book', { authors });
    });
});

app.post('/author/add', imageUpload.single('image'), (req, res) => {
    const { author_id, name, country } = req.body;
    const authorId = Number(author_id);
    if (!Number.isSafeInteger(authorId) || authorId <= 0 || !name?.trim()) {
        removeUploadedFile(req.file);
        return res.status(400).send('Please enter a valid author ID and name.');
    }
    const photo = req.file ? req.file.filename : null;
    db.query('INSERT INTO AUTHOR (author_id, name, country, photo) VALUES (?, ?, ?, ?)',
        [authorId, name.trim(), country?.trim() || null, photo], (err) => {
            if (err) {
                removeUploadedFile(req.file);
                return res.status(500).send('Error adding author: ' + err.message);
            }
            res.redirect('/dashboard');
        });
});

app.post('/book/add', imageUpload.single('image'), (req, res) => {
    const { book_id, title, price, publish_year, author_id, publisher_id, category_id } = req.body;
    const bookId = Number(book_id);
    const bookPrice = Number(price);
    const publishYear = Number(publish_year);
    const authorId = Number(author_id);
    const publisherId = Number(publisher_id);
    const categoryId = Number(category_id);

    if (
        !Number.isSafeInteger(bookId) || bookId <= 0 ||
        !title?.trim() ||
        !Number.isFinite(bookPrice) || bookPrice < 0 ||
        !Number.isSafeInteger(publishYear) ||
        !Number.isSafeInteger(authorId) ||
        !Number.isSafeInteger(publisherId) ||
        !Number.isSafeInteger(categoryId)
    ) {
        removeUploadedFile(req.file);
        return res.status(400).send('Please enter valid book information.');
    }

    const coverImage = req.file ? req.file.filename : null;
    db.query(
        `INSERT INTO BOOK (book_id, title, price, publish_year, author_id, publisher_id, category_id, cover_image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookId, title.trim(), bookPrice, publishYear, authorId, publisherId, categoryId, coverImage],
        (err) => {
            if (err) {
                removeUploadedFile(req.file);
                return res.status(500).send('Error adding book: ' + err.message);
            }
            res.redirect('/dashboard');
        }
    );
});

app.get('/author/edit/:id', (req, res) => {
    const authorId = Number(req.params.id);
    if (!Number.isSafeInteger(authorId) || authorId <= 0) return res.status(400).send('Invalid author ID.');
    db.query('SELECT * FROM AUTHOR WHERE author_id = ?', [authorId], (err, authors) => {
        if (err) return res.status(500).send('Database error: ' + err.message);
        if (authors.length === 0) return res.status(404).send('Author not found.');
        res.render('edit_author', { author: authors[0] });
    });
});

app.post('/author/edit/:id', imageUpload.single('image'), (req, res) => {
    const authorId = Number(req.params.id);
    const { name, country } = req.body;
    if (!Number.isSafeInteger(authorId) || authorId <= 0 || !name?.trim()) {
        removeUploadedFile(req.file);
        return res.status(400).send('Please enter a valid author name.');
    }
    db.query('SELECT photo FROM AUTHOR WHERE author_id = ?', [authorId], (selectError, authors) => {
        if (selectError) {
            removeUploadedFile(req.file);
            return res.status(500).send('Database error: ' + selectError.message);
        }
        if (authors.length === 0) {
            removeUploadedFile(req.file);
            return res.status(404).send('Author not found.');
        }
        const oldPhoto = authors[0].photo;
        const photo = req.file ? req.file.filename : oldPhoto;
        db.query(
            'UPDATE AUTHOR SET name = ?, country = ?, photo = ? WHERE author_id = ?',
            [name.trim(), country?.trim() || null, photo, authorId],
            (updateError) => {
                if (updateError) {
                    removeUploadedFile(req.file);
                    return res.status(500).send('Error updating author: ' + updateError.message);
                }
                if (req.file && oldPhoto) {
                    fs.unlink(path.join(uploadDirectory, oldPhoto), () => {});
                }
                res.redirect('/dashboard');
            }
        );
    });
});

app.get('/book/edit/:id', (req, res) => {
    const bookId = Number(req.params.id);
    if (!Number.isSafeInteger(bookId) || bookId <= 0) return res.status(400).send('Invalid book ID.');
    db.query('SELECT * FROM BOOK WHERE book_id = ?', [bookId], (err, books) => {
        if (err) return res.status(500).send('Database error: ' + err.message);
        if (books.length === 0) return res.status(404).send('Book not found.');
        db.query('SELECT * FROM AUTHOR', (authorError, authors) => {
            if (authorError) return res.status(500).send('Database error: ' + authorError.message);
            res.render('edit_book', { book: books[0], authors });
        });
    });
});

app.post('/book/edit/:id', imageUpload.single('image'), (req, res) => {
    const bookId = Number(req.params.id);
    const { title, price, publish_year, author_id, publisher_id, category_id } = req.body;
    const bookPrice = Number(price);
    const publishYear = Number(publish_year);
    const authorId = Number(author_id);
    const publisherId = Number(publisher_id);
    const categoryId = Number(category_id);

    if (
        !Number.isSafeInteger(bookId) || bookId <= 0 ||
        !title?.trim() ||
        !Number.isFinite(bookPrice) || bookPrice < 0 ||
        !Number.isSafeInteger(publishYear) ||
        !Number.isSafeInteger(authorId) ||
        !Number.isSafeInteger(publisherId) ||
        !Number.isSafeInteger(categoryId)
    ) {
        removeUploadedFile(req.file);
        return res.status(400).send('Please enter valid book information.');
    }

    db.query('SELECT cover_image FROM BOOK WHERE book_id = ?', [bookId], (selectError, books) => {
        if (selectError) {
            removeUploadedFile(req.file);
            return res.status(500).send('Database error: ' + selectError.message);
        }
        if (books.length === 0) {
            removeUploadedFile(req.file);
            return res.status(404).send('Book not found.');
        }

        const oldCover = books[0].cover_image;
        const coverImage = req.file ? req.file.filename : oldCover;

        db.query(
            `UPDATE BOOK
             SET title = ?, price = ?, publish_year = ?, author_id = ?,
                 publisher_id = ?, category_id = ?, cover_image = ?
             WHERE book_id = ?`,
            [title.trim(), bookPrice, publishYear, authorId, publisherId, categoryId, coverImage, bookId],
            (updateError) => {
                if (updateError) {
                    removeUploadedFile(req.file);
                    return res.status(500).send('Error updating book: ' + updateError.message);
                }
                if (req.file && oldCover) {
                    fs.unlink(path.join(uploadDirectory, oldCover), () => {});
                }
                res.redirect('/dashboard');
            }
        );
    });
});

app.get('/book/delete/:id', (req, res) => {
    db.query('DELETE FROM BOOK WHERE book_id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).send('Database error: ' + err.message);
        res.redirect('/dashboard');
    });
});

app.get('/author/delete/:id', (req, res) => {
    db.query('DELETE FROM AUTHOR WHERE author_id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).send('Database error: ' + err.message);
        res.redirect('/dashboard');
    });
});

app.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send('Images must be 5 MB or smaller.');
    }
    if (err.message === 'Choose a JPEG, PNG, WebP, or GIF image.') {
        return res.status(400).send(err.message);
    }
    next(err);
});