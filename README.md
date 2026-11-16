# Lab 4: Search Queries in SQL

Introduction to Database Systems · Faculty of Engineering, Alexandria National University · Fall 2026

This repository has Problem 1 (the extended COMPANY database, answered with SQL) and Problem 2 (the Library database with six tables and a website with six new search pages, continued from Lab 3).

## 1. Team

| Name | ID | Group |
|---|---|---|
| Youssef Mosaad | 2304034 | Gp 2 sec 4 |
| Abdelrahman Hazem | 2304275 | Gp 2 sec 4 |
| Abdelrahman Adel | 2304028 | Gp 2 sec 4 |

### Who did what

**Youssef Mosaad**
- Problem 1: `problem1_DDL.sql`, `problem1_DML.sql` and `problem1_Answers.txt` (Q1.1 to Q1.12).
- Website pages: F2.1 Search books, F2.2 Catalogue and F2.3 Reports, including their routes in `website/app.js`.
- Bonus: F2.1 uses prepared statements (placeholders) instead of building the SQL text from what the user typed.

**Abdelrahman Hazem**
- Problem 2: `problem2_DDL.sql`, `problem2_DML.sql` and `problem2_Queries.sql`.
- Website pages: F2.4 Loans, F2.5 Most borrowed and F2.6 Authors and books, including their routes in `website/app.js`.
- `website/db.js` and the book covers and author photos.

**Abdelrahman Adel**
- Validation: registration and login checks in `website/app.js`, `website/views/register.ejs` and `website/public/validate.js`.
- Validation of the Library page, including author, book and image-upload checks in `website/app.js`, `website/views/library.ejs` and `website/public/validate.js`.
- Shared work: this README, the navigation bar (`website/views/partials/nav.ejs`), the design (`website/public/style.css`), and testing all scripts and pages.

## 2. What is in this repository

| File or folder | What it is |
|---|---|
| `problem1_DDL.sql` | Creates the `company` database with EMPLOYEE (with `super_ssn`), DEPARTMENT, PROJECT, WORKS_ON and DEPENDENT, with primary keys (also composite) and foreign keys. |
| `problem1_DML.sql` | Inserts the rows: 7 employees, 3 departments, 4 projects, 8 works_on rows and 3 dependents. |
| `problem1_Answers.txt` | The SQL and the output or error for Q1.1 to Q1.12. |
| `problem2_DDL.sql` | Creates the `library` database with AUTHOR, PUBLISHER, CATEGORY, BOOK, MEMBER and LOAN, with `ON DELETE CASCADE`. |
| `problem2_DML.sql` | Seed data: 4 authors, 3 publishers, 3 categories, 10 books, 5 members and 12 loans. |
| `problem2_Queries.sql` | The SQL of the pages F2.1 to F2.6, with a `-- F2.x` comment before each query. |
| `users_schema.sql` | Creates the `users_db` database used for login. |
| `website/` | The website: the Lab 3 library page and the six new Lab 4 pages. |

## 3. Technology

| Part | What we used |
|---|---|
| Back end | Node.js, Express, express-session, bcryptjs, multer, mysql2, dotenv |
| Front end | EJS templates, HTML, CSS, JavaScript |
| Database | MySQL, plain SQL with parameters (no ORM) |

## 4. How to run it

1. Install **Node.js** and **MySQL** (with the MySQL client).
2. Download the project and open a terminal in its main folder.
3. Build the databases and insert the data:
   ```
   mysql -u root -p < users_schema.sql
   mysql -u root -p < problem1_DDL.sql
   mysql -u root -p < problem1_DML.sql
   mysql -u root -p < problem2_DDL.sql
   mysql -u root -p < problem2_DML.sql
   ```
4. Optional, to check the SQL of the pages in the client:
   ```
   mysql -u root -p library < problem2_Queries.sql
   ```
5. Go into the website folder and install the libraries:
   ```
   cd website
   npm install
   ```
6. Copy `.env.example` to a new file named `.env`, and write your own MySQL password after `DB_PASSWORD=` and any long text after `SESSION_SECRET=`. Leave the other values as they are (`DB_NAME=users_db`, `DB_LIBRARY_NAME=library`).
7. Start the server:
   ```
   node app.js
   ```
8. Open `http://localhost:3000`, click **Sign up here** to create an account, and log in. The links at the top of every page open the library page and the six new pages.

To type queries by hand for Problem 1, run `mysql -u root -p company`.

## 5. Features of the website

### The new pages (Problem 2)

| Page | What it shows | SQL used |
|---|---|---|
| F2.1 Search books (`/search`) | A form with a title keyword, a minimum and a maximum price and a category list; the matching books, cheapest first. | `WHERE`, `LIKE`, `BETWEEN`, `ORDER BY` |
| F2.2 Catalogue (`/catalogue`) | All the books with the author name, the publisher name and the category name instead of the ids. | `JOIN` of four tables |
| F2.3 Reports (`/reports`) | Number of books and average price of each category; authors who wrote at least 2 books; total, smallest and largest price of the library. | `GROUP BY`, `HAVING`, `SUM`, `MIN`, `MAX`, `AVG` |
| F2.4 Loans (`/loans`) | Loans not returned yet (book title and member name); members who never borrowed a book; books that were never borrowed. | `JOIN`, `LEFT JOIN`, `IS NULL` |
| F2.5 Most borrowed (`/borrowed`) | The 3 books with the most loans and the member with the most loans. | `GROUP BY`, `ORDER BY`, `LIMIT` |
| F2.6 Authors and books (`/authors-books`) | Every author with the number of books, including 0; the books whose author and publisher come from the same country. | `LEFT JOIN`, `JOIN` |

### Bonus

- **Prepared statements in F2.1:** the keyword, the prices and the category are sent to MySQL as parameters (`?`). No SQL text is built from what the user typed.

### From the earlier labs

- Register, login and logout with bcrypt password hashes and sessions. Every library page needs a logged-in user.
- The Library page: show, add, edit and delete books and authors. Deleting an author deletes all of their books (`ON DELETE CASCADE`), and deleting a book deletes its loans.
- Book covers and author photos (JPG, PNG, GIF or WEBP, 2 MB at most).

### Validation (browser and server)

| Where | Rules |
|---|---|
| Register | Name required, at most 100 characters, letters only; email required, valid format, at most 255 characters; password 8 to 72 characters and equal to the confirmation; `Email Already Exists` for a duplicate. |
| Login | Email and password required; the same `Invalid email or password` for a wrong email and a wrong password. |
| Search (F2.1) | Keyword at most 100 characters; minimum and maximum price must be numbers of 0 or more; minimum cannot be greater than maximum; the category must exist. A search with no result shows `No books found`. |
| Authors | ID a positive whole number; name required, at most 50 characters, letters only; country required, at most 30 characters; photo a JPG, PNG, GIF or WEBP file of 2 MB at most. |
| Books | ID a positive whole number; title required, at most 100 characters; price from 0 to 99999999.99 with at most 2 decimals; author ID a positive whole number of an existing author; cover image rules as above. |
| Every page | A visitor who is not logged in is sent to the login page. Unknown addresses and server errors show a friendly page, never a stack trace. Every empty table shows a friendly text. |

## 6. Notes

- The database has these foreign keys: `BOOK.author_id`, `BOOK.publisher_id` and `BOOK.category_id` refer to AUTHOR, PUBLISHER and CATEGORY; `LOAN.book_id` refers to BOOK and `LOAN.member_id` refers to MEMBER. `return_date` is `NULL` while a book is still borrowed.
- `MEMBER` is written with backticks in the SQL, because it is a keyword in recent MySQL versions.
- The website uses two databases: `users_db` for the accounts and `library` for the books, authors and loans. The `company` database is only used for Problem 1 in the MySQL client.
- The images of the seed data are in `website/public/uploads`.
- The scripts start with `DROP DATABASE IF EXISTS`, so they can be run again at any time.



