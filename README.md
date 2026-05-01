# 📚 EduSphere — Academic Discussion Platform


> **Where Curiosity Meets Expertise** — A structured discussion platform for students and faculty to ask academic questions, share solutions, vote on answers, and build reputation.

🌐 **Live Demo:** [https://full-stack-project-sem-4.onrender.com](https://full-stack-project-sem-4.onrender.com)

---

## 🧠 About the Project

**EduSphere** is a full-stack academic Q&A web application built for university students and faculty. It works like a smart discussion forum — but made specifically for education.

Students and teachers can come together in one place to:
- Ask academic questions categorized by **subject** and **course code**
- Answer and discuss topics with the community
- Upvote/downvote answers to surface the best responses
- Earn **reputation scores** for quality contributions
- Discover **trending discussions** powered by a live scoring algorithm

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure register and login as Student or Faculty
- ❓ **Ask Questions** — Post questions with subject & course categorization
- 💬 **Answer Threads** — Reply to questions; answers sorted by votes
- 👍 **Voting System** — Upvote/downvote answers; prevents duplicate voting
- ⭐ **Reputation Scores** — Earn points when your answers get upvoted
- 🔥 **Trending Feed** — Algorithmically ranked by answers, votes, and recency
- 🔍 **Filter & Paginate** — Browse by subject, course code, and page number
- 🏷️ **Faculty Badge** — Faculty answers are visually distinguished
- 📊 **Live Stats** — Animated counters for questions, answers, and members
- 🍞 **Toast Notifications** — Success/error/info toasts for all user actions
- 📝 **Activity Logging** — Server-side event logging to `activity.log`
- 💅 **Splash Screen** — Branded loading experience on first visit

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML, CSS3, JavaScript |
| **Backend** | Node.js |
| **Database** | MongoDB |
| **Authentication** | JWT (JSON Web Tokens) |
| **Deployment** | Render |

---

## 🔄 How It Works

1. **User registers** with name, email, password, and role (Student or Faculty)
2. **User logs in** and receives a signed JWT token stored in localStorage
3. **User posts a question** with a title, description, subject, and course
4. **Other users browse** the feed and post their answers
5. **Users vote** on answers — upvote the helpful ones, downvote the rest
6. **Reputation updates** — answer authors gain or lose points based on votes
7. **Trending system** identifies and highlights the most active discussions
8. **Anyone can filter** questions by subject or course to find relevant content

---

## 🏠 Screens & Views

| Screen | Description |
|--------|-------------|
| 🏠 **Home / Hero** | Introduction, platform stats, and call-to-action buttons |
| 📋 **Feed** | Browse all questions with subject/course filters and pagination |
| 🔥 **Trending** | Most active discussions ranked by the trending algorithm |
| ✍️ **Ask Question** | Form to post a new question with subject and course tags |
| 💬 **Question Detail** | Full question with all answers, voting controls, and reply form |
| 🔑 **Login / Register** | Modal popup for authentication |


## 📚 Supported Subjects & Courses

| Subject | Course Code |
|---------|-------------|
| Computer Organization and Design | CSE211 |
| Programming in JAVA | CSE310 |
| Operating System | CSE316 |
| Operating System Lab | CSE325 |
| Front End Web Developer | INT219 |
| Advanced Web Development | INT222 |
| Artificial Intelligence | INT428 |
| Analytical Skills | PEA307 |

---

## 📊 Future Improvements

- 🔔 **Notifications** — Alerts for new answers and votes on your posts
- 💬 **Real-time chat** — Live discussion inside question threads via WebSockets
- 🔖 **Bookmarks** — Save questions to read later
- 🔍 **Full-text search** — Smart search with suggestions across all questions
- 📱 **Mobile app** — Native Android and iOS versions

---

## 🤝 Contributing

Contributions are welcome!

---

## 👨‍💻 Author

**Nishant Mangal**

- 📧 [mangalnishant1206@gmail.com](mailto:mangalnishant1206@gmail.com)
- 🌐 [Live Project](https://full-stack-project-sem-4.onrender.com)
- 💼 [LinkedIn](https://www.linkedin.com/posts/nishant-mangal-6357a9313_webdevelopment-fullstackdeveloper-mern-activity-7454234743778201600-a7I6?utm_source=share&utm_medium=member_desktop&rcm=ACoAAE-sbkkBbiA7HTPbOLz175m5vxYVNxHwTDM)

