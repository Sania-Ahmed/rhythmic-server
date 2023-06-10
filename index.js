const express = require('express');
const app = express();
const cors = require('cors') ;
const jwt = require('jsonwebtoken');
require('dotenv').config() ;
const port = process.env.PORT || 5000 ;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
const authorization = req.headers.authorization ;
if(!authorization){
  return res.status(401).send({error:true, massage: 'unauthorized access'});
}
const token = authorization.split(' ')[1];
jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
  if(err){
    return res.status(401).send({error:true, massage: 'unauthorized access'})
  }
  req.decoded = decoded;
  next();
} )
}

app.get('/', ( req, res) => {
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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const database = client.db("rhythmicDb");
    const classCollection = database.collection("class");
    const listCollection = database.collection("list");
    const usersCollection = database.collection("users");
    
   app.post('/jwt', (req,res) => {
    const user = req.body ;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn : '1h'})
    res.send({token}) ;
   })
// class APIs
   app.get('/class', async(req, res) => {
    const result = await classCollection.find().toArray();
    res.send(result) ;
   })
//  users APIS 
  app.post('/users', async(req, res) => {
    const user = req.body ;
    const query = {email: user.email}
    const existingUser = await usersCollection.findOne(query);
    if(existingUser){
      return res.send({message: 'user already exist'})
    }
    const result = await usersCollection.insertOne(user);
    res.send(result);
  })
  
  app.get('/users',verifyJWT, async(req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  })

  app.get('/users/admin/:email' , verifyJWT, async (req, res) => {
    const email = req.params.email ;
    if(req.decoded.email !== email) {
      res.send({admin: false})
    }
    const query = {email : email}
    const user = await usersCollection.findOne(query) ;
    const result = {admin: user?.role === 'admin'}
    res.send(result); 
  })

  app.patch('/users/admin/:id', async(req,res) => {
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)};
    const updateDoc = {
      $set: {
        role: 'admin'
      },
    };

    const result= await usersCollection.updateOne(filter, updateDoc);

    res.send(result);

  })

  app.get('/users/instructor/:email' , verifyJWT, async (req, res) => {
    const email = req.params.email ;
    if( req.decoded.email !== email) {
      res.send({instructor: false})
    }
    const query = {email : email}
    const user = await usersCollection.findOne(query) ;
    const result = {instructor: user?.role === 'instructor'}
    res.send(result); 
  })

  app.patch( '/users/instructor/:id', async(req,res) => {
    const id = req.params.id;
    console.log(id)
    const filter = {_id: new ObjectId(id)};
    const updateDoc = {
      $set: {
        role: 'instructor'
      },
    };
    const result= await usersCollection.updateOne(filter, updateDoc);

    res.send(result);

  })

  //  list collection
   app.post('/lists', async (req,res) => {
    const item = req.body ;
    const result = await listCollection.insertOne(item) ;
    res.send(result) ;
   })

   app.get('/lists' ,verifyJWT, async (req, res) => {
    const email = req.query.email ;
    console.log(email) 
    if(!email){
      res.send([])
    }
    const decodedEmail = req.decoded.email ;
    console.log(decodedEmail) ;
    if(email !== decodedEmail){
      return res.status(403).send({error: true, message: 'forbidden access'})
    }
    const query = { email : email}; 
    const result = await listCollection.find(query).toArray() ;
    console.log(result) ;
    res.send(result) ;
   })

   app.delete('/lists/:id' , async(req,res) => {
    const id = req.params.id ;
        const query = {_id: new ObjectId(id) } ;
        const result = await listCollection.deleteOne(query) ;
        res.send(result) ;
   })










    // Send a ping to confirm a successful connection
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

