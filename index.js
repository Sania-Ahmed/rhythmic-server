const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, massage: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, massage: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

app.get('/', (req, res) => {
  res.send('rhythmic is playing')
})


// mongo db 

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.74wxpsk.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    
    const database = client.db("rhythmicDb");
    const classCollection = database.collection("class");
    const listCollection = database.collection("list");
    const usersCollection = database.collection("users");
    const paymentCollection = database.collection("payments");


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token });
    })
    // class APIs
    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })
    app.get('/class/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })
    app.post('/class', verifyJWT, async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass)
      res.send(result);
    })
    app.patch('/approvedClass/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const approved = {
        $set: {
          status: 'approved'
        },
      };
      const result = await classCollection.updateOne(filter, approved);

      res.send(result);
    })
    app.patch('/deniedClass/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const denied = {
        $set: {
          status: 'denied'
        },
      };
      const result = await classCollection.updateOne(filter, denied);

      res.send(result);
    })
    app.patch( '/feedback/:id', async (req, res) => {
      console.log(req.body.feedback) ;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const sendFeedback = {
        $set: {
          feedback: req.body.feedback
        },
      };
      const result = await classCollection.updateOne(filter, sendFeedback);
      res.send(result);
    })

    //  users APIS 
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exist' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);

      res.send(result);

    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);

      res.send(result);

    })

    //  list collection
    app.post('/lists', async (req, res) => {
      const item = req.body;
      const result = await listCollection.insertOne(item);
      res.send(result);
    })

    app.get('/lists', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email)
      if (!email) {
        res.send([])
      }
      const decodedEmail = req.decoded.email;
      console.log(decodedEmail);
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const query = { email: email };
      const result = await listCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    })

    app.delete('/lists/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await listCollection.deleteOne(query);
      res.send(result);
    })


    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      });

      res.send({ clientSecret: paymentIntent.client_secret })
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      payment.createdAt = new Date();
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { itemId: payment?.itemId };
      const deleteResult = await listCollection.deleteOne(query);
      const updateQuery = { _id: new ObjectId(payment.itemId) };
      const updateOperation =
      {
        $set: {
          enrolled: true,
          students: payment?.students + 1,
          available_seats: parseInt(payment?.seats) - 1
        }
      };
      const updateResult = await classCollection.updateOne(updateQuery, updateOperation);

      res.send({ insertResult, updateResult, deleteResult });
    })

    app.get('/payments/:email', async(req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).sort({ createdAt: -1 }).toArray() ;

      res.send(result) ;
      
    })



    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`running on ${port}`)
})

