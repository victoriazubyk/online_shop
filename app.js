
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');


const saltRounds = 15;
const mySecret = "secret618";

const app = express();
app.use(express.static('static/css'));
app.use(cookieParser());
app.use(express.static(__dirname + '../main_page'));
app.use(express.urlencoded({extended:false}))

app.use(express.static(__dirname + '/static'));

const Pool = require('pg').Pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'net_shop',
  password: 'srtzk',
  port: 5432,
})

app.set('views', __dirname+'/ejs');
app.set('view engine', 'ejs');


/////////////////////////registration//////////////////////////////

app.get('/registration',(req,res)=>{
  var token = req.cookies['token'];
  if (!token){
     res.sendFile(path.join(__dirname+'/static/html/registration.html'));
  }else{
    jwt.verify(token, mySecret, function(err, decoded) {
      if (err) res.sendFile(path.join(__dirname+'/static/html/registration.html'));
      else res.redirect('/main_page')
    });
  }
});
const createUser = (request, response) => {
  const { email, psw, psw_repeat} = request.body
  const pass_hash = bcrypt.hash(psw, saltRounds, function (err,   hash){
    console.log(hash);
    pool.query('INSERT INTO users (login, password, type) VALUES ($1, $2, $3)', [email, hash, "user"], (error, results) => {
      try{
        if (error) {
          throw error
        }
        console.log("registred");
      }catch (e){
        console.log(e);
        response.redirect("/login");}
      })
  });
}
app.post('/registration', createUser)

//////////////////////////login/////////////////////////////////

app.get('/login',(req,res)=>{
  var token = req.cookies['token'];
  if (!token)
  {
    res.sendFile(path.join(__dirname+'/static/html/login.html'));
  }else{
    jwt.verify(token, mySecret, function(err, decoded) {
      if (err) res.sendFile(path.join(__dirname+'/static/html/login.html'));
      else
      res.redirect('/main_page');
    });
  }
});
const getUser = (request, response) => {
  const {email, psw} = request.body
    console.log(email,psw);
    pool.query('SELECT * FROM users WHERE login=$1', [email], (error, results) => {
      try{
        var email_1 = results.rows[0]['login'];
        var pass = results.rows[0]['password'];
        var type = results.rows[0]['type'];
        var id_user = results.rows[0]['id'];
        bcrypt.compare(psw, pass, function(err, res) {
          try{
              if (err){
                throw "Password do not match"
              }
              if (res){
                var token = jwt.sign({ id: id_user, type: type}, mySecret, { expiresIn: 86400 });
                response.cookie('token', token);
                response.redirect("/main_page");
              } else {
                response.json({message: 'Passwords do not match'});
                response.end();
              }
          }catch(e)
          {
            console.log(e);
            response.redirect("/login");
          }
        });
        if (error) {throw "Error while finding user"}
      }catch (e){
        console.log(e);
        response.redirect("/login");}
      });
}
app.post('/login', getUser)


app.get('/logout',(req,res)=>{
  res.clearCookie("token");
  res.redirect("/login");
});


///////////////////////////TYPE//////////////////////////////
app.get('/',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    if(decoded['type']=='user')res.render('main_page', { header: 'header_user' });
    else res.render('main_page', { header: 'header_admin' });
  });
});
app.get('/main_page',(req,res)=>{
  var token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    else{
    if(decoded['type']== 'user')res.render('main_page', { header: 'header_user' });
    else res.render('main_page', { header: 'header_admin' });
    }
  });
});

/////////////////////////////ADD/////////////////////////////

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

app.get('/add',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    else{
      if(decoded['type']=='admin')res.render('add', { header: 'header_admin'});
      else res.redirect("/goods");
    }
  });
});
const createGoods = (request, response) => {
  const { title, price } = request.body
  pool.query('INSERT INTO goods (title, price, discount, id) VALUES ($1, $2, $3, $4)', [title, price, 0,getRandomInt(100000) ], (error, results) => {
    try{
      if (error) {
        throw error
      }
      response.redirect("/goods")
    }catch (e){
      console.log(e);
      response.redirect("/add");}
    });
}
app.post('/add', createGoods)


/////////////////////////////BASKET////////////////////////////////

app.get('/basket',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    else{
    pool.query('select basket.id_b, title, price, discount, id as id_goods from basket join goods on basket.id_goods = goods.id  where id_user = $1', [decoded['id']], (error, results) => {
      if(decoded['type']=='user')res.render('basket', { header: 'header_user' , goods: results.rows});
      else res.redirect("/goods");
      });
    }
  });
});
const delete_from_basket = (request, response) => {
  const token = request.cookies['token'];
  if (!token) response.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) response.redirect("/login");
    else{
    pool.query('DELETE from basket where id=$1', [request.body['id']], (error, results) => {
      try{
        if (error) {
          throw "Error while deleting from basket."
        }
        console.log("Deleted from basket: "+request.body['id']);
      }catch (e){
        console.log(e);}
      });
    }
  });
}
const buy_all_from_basket = (request, response) => {
  const token = request.cookies['token'];
  if (!token) response.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) response.redirect("/login");
    else{
      pool.query('SELECT * FROM basket where id_user=$1',[decoded['id']], (error, results1) => {
        try{
          if (error) {
            throw "Error while selecting all from basket."
          }

        }catch (e){
          console.log(e);}
        });

        pool.query('DELETE from basket where id_user=$1', [decoded['id']], (error, results) => {
          try{
            if (error) {
              throw "Error while deleting from basket."
            }
            console.log("Deleted from basket all goods for user: "+decoded['id']);
          }catch (e){
            console.log(e);}
          });
    }
  });
}
app.post('/basket-delete', delete_from_basket)
app.post('/basket-buy-all', buy_all_from_basket)


/////////////////////////////GOODS////////////////////////////////////

app.get('/goods/:pageId',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    else{
      if(req.params.pageId<0) res.redirect("/goods/0");
      else{
          pool.query('select count(*) from goods', (error, results1) => {
            pool.query('select * from goods offset $1 limit $2', [req.params.pageId* 5,  5], (error, results) => {
              if(decoded['type']=='user')res.render('goods', { header: 'header_user' , goods: results.rows,
                cnt: Math.ceil((parseInt(results1.rows[0]['count'])+1)/ 5), pageId: req.params.pageId});
              else res.render('admin_goods', { header: 'header_admin' , goods: results.rows,
                cnt: Math.ceil((parseInt(results1.rows[0]['count'])+1)/ 5), pageId: req.params.pageId});
              });
          });
        }
    }
  });
});
app.get('/goods',(req,res)=>{
  const token = req.cookies['token'];
  if (!token) res.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) res.redirect("/login");
    else{
      res.redirect("/goods/0")
    }
  });
});
const add_to_basket = (request, response) => {
  const token = request.cookies['token'];
  if (!token) response.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) response.redirect("/login");
    else{
      console.log(request.body['id']);
    pool.query('INSERT INTO basket (id_user,id_goods) VALUES ($1, $2)', [decoded['id'], request.body['id']], (error, results) => {
      try{
        if (error) {
          console.log(error)
          throw "Error while inserting"
        }
        console.log("Added to basket: "+request.body['id']);
      }catch (e){
        console.log(e);}
      });
    }
  });
}
const delete_goods = (request, response) => {
  const token = request.cookies['token'];
  if (!token) response.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) response.redirect("/login");
    else{
        pool.query('DELETE from basket where id_goods=$1', [request.body['id_goods']], (error, results) => {
          try{
            if (error) {
              throw "Error while deleting from basket."
            }
          }catch (e){шв
            console.log(e);}
          });
        pool.query('DELETE from goods where id=$1', [request.body['id']], (error, results) => {
          try{
            if (error) {
              throw "Error while deleting from basket."
            }
          }catch (e){
            console.log(e);}
          });
    }
  });
}
const add_discount = (request, response) => {
  const token = request.cookies['token'];
  if (!token) response.redirect("/login");
  jwt.verify(token, mySecret, function(err, decoded) {
    if (err) response.redirect("/login");
    else{
    pool.query('update goods set discount = $1 where id=$2', [request.body['discount'], request.body['id']], (error, results) => {
      try{
        if (error) {
          throw "Error while setting dicount."
        }
        console.log("Added discount to: "+request.body['id']);
      }catch (e){
        console.log(e);}
      });
    }
  });
}
app.post('/goods', add_to_basket)
app.post('/delete_goods', delete_goods)
app.post('/goods-discount', add_discount)


app.listen(3000, () => {
  console.log('Server is work!');
});
