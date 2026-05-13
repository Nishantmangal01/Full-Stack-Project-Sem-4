const http = require('http');          
const path = require('path');          
const fs = require('fs');            
const EventEmitter = require('events');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();


const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI ;
const JWT_SECRET = process.env.JWT_SECRET ;

class EdusphereEmitter extends EventEmitter { }
const appEmitter = new EdusphereEmitter();

const LOG_FILE = path.join(__dirname, 'activity.log');

function writeLog(entry) {
  const line = `[${new Date().toISOString()}] ${entry}\n`;
  fs.appendFile(LOG_FILE, line, err => { if (err) console.error('Log error:', err); });
}

appEmitter.on('question:created', (data) => {
  writeLog(`NEW QUESTION | user:${data.userId} | subject:${data.subject} | "${data.title}"`);
});
appEmitter.on('answer:posted', (data) => {
  writeLog(`NEW ANSWER   | user:${data.userId} | question:${data.questionId}`);
});
appEmitter.on('user:registered', (data) => {
  writeLog(`NEW USER     | name:${data.name} | role:${data.role}`);
});
appEmitter.on('vote:cast', (data) => {
  writeLog(`VOTE         | user:${data.userId} | answer:${data.answerId} | vote:${data.vote}`);
});



const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['student', 'faculty'], default: 'student' },
  reputation: { type: Number, default: 0 },
}, { timestamps: true });

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

const User = mongoose.model('User', UserSchema);

const AnswerSchema = new mongoose.Schema({
  answer: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  votes: { type: Number, default: 0 },
  votedBy: [{ userId: mongoose.Schema.Types.ObjectId, vote: Number }],
}, { timestamps: true });

const QuestionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 10, maxlength: 200 },
  description: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true, uppercase: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [AnswerSchema],
  trendScore: { type: Number, default: 0 },
}, { timestamps: true });

QuestionSchema.index({ subject: 1, course: 1, createdAt: -1 });

QuestionSchema.methods.computeTrend = function () {
  const ansCount = this.answers.length;
  const totalVotes = this.answers.reduce((s, a) => s + (a.votes || 0), 0);
  const ageHours = (Date.now() - new Date(this.createdAt).getTime()) / 3600000;
  const recency = Math.max(0, 100 - ageHours);
  return (ansCount * 3) + (totalVotes * 2) + recency;
};

const Question = mongoose.model('Question', QuestionSchema);

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());                  
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.msi')) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="tightvnc-2.8.87-gpl-setup-64bit.msi"');
    }
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${ms}ms)`);
  });
  next();
});

function errorHandler(err, req, res, next) {
  console.error('Error stack:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
} 


function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ message: 'No token provided' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireFaculty(req, res, next) {
  if (req.user?.role !== 'faculty') {
    return res.status(403).json({ message: 'Faculty access required' });
  }
  next();
}

const router = express.Router();


router.post('/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = new User({ name, email, password, role: role || 'student' });
    await user.save();

    appEmitter.emit('user:registered', { name: user.name, role: user.role });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role, reputation: user.reputation },
      JWT_SECRET, { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registered successfully',
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, reputation: user.reputation },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role, reputation: user.reputation },
      JWT_SECRET, { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, reputation: user.reputation },
    });
  } catch (err) {
    next(err);
  }
});


router.get('/questions', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 8);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.subject) filter.subject = new RegExp(req.query.subject, 'i');
    if (req.query.course) filter.course = new RegExp(req.query.course, 'i');

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name role reputation'),
      Question.countDocuments(filter),
    ]);

    res.json({
      questions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/questions/trending', async (req, res, next) => {
  try {
    const raw = await Question.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name role reputation');

    const scored = raw
      .map(q => {
        const doc = q.toObject({ virtuals: false });
        const ansCount = q.answers.length;
        const totalVotes = q.answers.reduce((s, a) => s + (a.votes || 0), 0);
        const ageHours = (Date.now() - new Date(q.createdAt).getTime()) / 3600000;
        const recency = Math.max(0, 100 - ageHours * 2);
        doc._trendScore = (ansCount * 3) + (totalVotes * 2) + recency;
        return doc;
      })
      .sort((a, b) => b._trendScore - a._trendScore)
      .slice(0, 10);

    res.json({ questions: scored });
  } catch (err) {
    next(err);
  }
});

router.get('/questions/:id', async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('userId', 'name role reputation')
      .populate('answers.userId', 'name role reputation');

    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ question });
  } catch (err) {
    next(err);
  }
});

router.post('/questions', authenticate, async (req, res, next) => {
  try {
    const { title, description, subject, course } = req.body;
    if (!title || !description || !subject || !course) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const question = new Question({
      title, description, subject, course,
      userId: req.user.id,
    });
    await question.save();

    appEmitter.emit('question:created', {
      userId: req.user.id, subject, title: title.substring(0, 60),
    });

    res.status(201).json({ message: 'Question created', question });
  } catch (err) {
    next(err);
  }
});


router.post('/questions/:id/answers', authenticate, async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ message: 'Answer text required' });

    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    question.answers.push({ answer: answer.trim(), userId: req.user.id, votes: 0 });
    await question.save();

    appEmitter.emit('answer:posted', { userId: req.user.id, questionId: question._id });

    res.status(201).json({ message: 'Answer posted', question });
  } catch (err) {
    next(err);
  }
});

router.patch('/questions/:id/answers/:answerId/vote', authenticate, async (req, res, next) => {
  try {
    const { vote } = req.body;  // 1 or -1
    if (vote !== 1 && vote !== -1) return res.status(400).json({ message: 'Vote must be 1 or -1' });

    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const answer = question.answers.id(req.params.answerId);
    if (!answer) return res.status(404).json({ message: 'Answer not found' });

    const existingVote = answer.votedBy.find(v => v.userId.toString() === req.user.id);
    if (existingVote) {
      if (existingVote.vote === vote) {
        return res.status(400).json({ message: 'You already voted this way' });
      }
      answer.votes += (vote - existingVote.vote);
      existingVote.vote = vote;
    } else {
      answer.votes += vote;
      answer.votedBy.push({ userId: req.user.id, vote });
    }

    await question.save();

    if (answer.userId) {
      const repDelta = vote === 1 ? 2 : -1;
      await User.findByIdAndUpdate(answer.userId, { $inc: { reputation: repDelta } });
    }

    appEmitter.emit('vote:cast', { userId: req.user.id, answerId: answer._id, vote });

    res.json({ message: 'Vote recorded', votes: answer.votes });
  } catch (err) {
    next(err);
  }
});


router.get('/stats', async (req, res, next) => {
  try {
    const [questions, users] = await Promise.all([
      Question.countDocuments(),
      User.countDocuments(),
    ]);
    const answerCount = await Question.aggregate([
      { $project: { count: { $size: '$answers' } } },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]);
    res.json({
      questions,
      users,
      answers: answerCount[0]?.total || 0,
    });
  } catch (err) {
    next(err);
  }
});


app.use('/api', router);
app.use(errorHandler);

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
  // Validate required environment variables first
  const missing = [];
  if (!process.env.MONGO_URI)  missing.push('MONGO_URI');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Set them in Render: Your Service > Environment tab.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('MongoDB Connected successfully');

    const server = http.createServer(app);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('Server start failed:', err.message);
    process.exit(1);
  }
}

startServer();