const express = require("express");


const app = express();
const path = require("path");
const propertyModel = require("./models/properties-model");
const userModel = require("./models/user-model");
const cookieParser = require("cookie-parser");
const upload = require("./config/multer.config");
const Blog = require("./models/blog-model");
const adminModel = require("./models/admin-model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const blogModel = require("./models/blog-model");
require("dotenv").config();

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const S3_BUCKET_REGION = process.env.S3_BUCKET_REGION;
const S3_BUCKET_ACCESS_KEY = process.env.S3_BUCKET_ACCESS_KEY;
const S3_BUCKET_SECRET_ACCESS_KEY = process.env.S3_BUCKET_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: S3_BUCKET_ACCESS_KEY,
    secretAccessKey: S3_BUCKET_SECRET_ACCESS_KEY,
  },
  region: S3_BUCKET_REGION,
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.json({limit: "20mb"}));
app.use(cookieParser());
app.use(express.urlencoded({ limit: "20mb" ,extended: true }));

// app.use("/images/uploads/properties", express.static(path.join(__dirname, "public/images/uploads/properties")));
// app.use("/images/uploads/blogs", express.static(path.join(__dirname, "public/images/uploads/blogs")));
// // app.use("images/uploads/content-images", express.static(path.join(__dirname, "public/images/uploads/content-images")));
// const cors = require("cors");

// app.use(
//   cors(
//     {
//     origin: 'http://159.65.159.15', // Frontend URL

//     credentials: true,              // Allow cookies
//   }
//       )
// );

app.use(
  cors({
    origin: "*", // Allow all origins
    credentials: true, // Optional: Allow cookies
  })
);

// app.use('/ejs', createProxyMiddleware({
//   target: process.env.BACKEND_SERVER_URL,  // Target your backend server
//   changeOrigin: true,               // Change the origin of the host header to match the target
//   secure: false,                    // If you're working with non-https servers (local dev)
//   pathRewrite: {
//     // '^/api': '',                    // Optionally rewrite the URL path if needed
//   },
//   onProxyReq: (proxyReq, req, res) => {
//     // You can also log the requests or modify headers here if needed
//     console.log(`Proxying request to: ${proxyReq.path}`);
//   }
// }));

// Serve static files from the React app
// app.use(express.static(path.join(__dirname, "../frontend/dist")));

// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
// });

// const cors = require('cors');

//EJS ROUTES
app.get("/test", (req, res) => {
  res.status(200).send("register");
});
//admin register
app.get("/", (req, res) => {
  res.render("register");
});
app.get("/home", async (req, res) => {
  const properties = await propertyModel.find();
  const users = await userModel.find();
  const blogs = await Blog.find();

  res.render("home", { properties, users, blogs });
});

app.get("/blog-form", (req, res) => {
  res.render("blog-form");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/properties", async (req, res) => {
  try {
    const properties = await propertyModel.find(); // Fetch all properties from the database
    res.render("properties", { properties }); // Pass data to the EJS template
  } catch (error) {
    res.status(500).send("Error fetching properties");
  }
});

app.get("/property/:id", async (req, res) => {
  try {
    const property = await propertyModel.findById(req.params.id);
    res.render("propertyDetail", { property });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/blog-details/:id", async (req, res) => {
  try {
    const blog = await blogModel.findById(req.params.id);
    res.render("blogDetails", { blog });
  } catch (err) {
    res.status(500).send(err);
  }
});

//blogs
app.get("/blog", async (req, res) => {
  const blogs = await Blog.find();
  // console.log("Fetched blogs:", blogs); // Verify the output
  res.render("blogs", { blogs });
});

// ADMIN APIS
app.post("/admin-api/register", async (req, res) => {
  try {
    // Destructure and validate input
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).send("All fields are required.");
    }

    // Check if the admin already exists
    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(400).send("Admin with this email already exists.");
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the new admin
    const admin = await adminModel.create({
      username,
      email,
      password: hashedPassword,
    });
    const jwtSecret = process.env.JWT_SECRET;
    // Generate JWT token
    const token = jwt.sign(
      { email: admin.email, adminid: admin._id },
      "secret" // Replace "mySecretKey" with a more secure key for production
      // Token expiry time
    );

    // Set the token as a cookie
    res.cookie("token", token, {
      httpOnly: true, // Ensures the cookie is only accessible by the server
      secure: false, // Use `true` only in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    console.log("Admin created successfully:", admin);

    // Redirect to the home page
    // return res.status(200).send({ message: "Admin created Successfully!" });
    res.redirect("/home");
  } catch (error) {
    console.error("Error during admin registration:", error.message);
    res
      .status(500)
      .send("An error occurred during registration. Please try again.");
  }
});

app.post("/admin-api/login", async (req, res) => {
  let { email, password } = req.body;
  let admin = await adminModel.findOne({ email });
  //  const jwtSecret = process.env.JWT_SECRET ;
  if (!admin) res.status(400).send("No User Found!");
  else {
    bcrypt.compare(password, admin.password, (err, result) => {
      if (result) {
        const token = jwt.sign(
          { email: admin.email, userid: admin._id },
          "secret"
        );
        res.cookie("token", token);
        res.redirect("/home");
        // return res.json({ message: "login successfull",redirect:'/home'  });
      } else {
        res.status(400).send("password is wrong");
      }
    });
  }
});

app.get("/admin-api/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("/login");
});

//upload property
app.post(
  "/admin-api/upload-property",
  upload.array("Images", 10),
  async (req, res) => {
    try {
      const {
        title,
        mainCategory,
        subCategory,
        area,
        bedrooms,
        location,
        price,
      } = req.body;
      console.log(req.body)

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }
console.log(req.files)
      const imageUrls = [];

      // Loop through each uploaded file
      for (const file of req.files) {
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(
            `File buffer is empty for file: ${file.originalname}`
          );
        }

        const uniqueKey = `properties/${Date.now()}-${file.originalname}`;
        console.log(uniqueKey)
        const command = new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: uniqueKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        });
        console.log(command)
        await s3.send(command);

        // Construct the public URL

        const imageUrl = `https://${S3_BUCKET_NAME}.s3.${S3_BUCKET_REGION}.amazonaws.com/${uniqueKey}`;
        imageUrls.push(imageUrl);
      }

      const property = new propertyModel({
        title,
        Images: imageUrls, // Save the array of image filenames
        mainCategory,
        subCategory,
        area,
        bedrooms,
        location,
        price,
      });
      await property.save();
      console.log("Property saved successfully!", property);
      // res.status(201).json({message:"Property uploaded successfully!", redirect:"/properties"});
      res.redirect("/properties");
    } catch (error) {
      console.error("Error uploading property:-------------->", error);
      // res.status(500).send("Error uploading property" + error);
      res.status(500).send({message:"Error uploading property nhi ho rhi " , error});
    }
  }
);

//property delete
app.post("/admin-api/properties/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const property = await propertyModel.findByIdAndDelete(id);

    if (!property) {
      return res.status(404).render("error", { message: "Property not found" });
    }
    res.status(200).json({
      message: "Property deleted successfully!",
      redirect: "/properties",
    });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).render("error", { message: "Error deleting property" });
  }
});

app.post(
  "/admin-api/properties/:id/edit",
  upload.array("Images", 5),
  async (req, res) => {
    const { id } = req.params;

    try {
      const property = await propertyModel.findById(id);

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Update property details
      const { title, location, area, bedrooms, bathrooms, price, description } =
        req.body;

      if (title) property.title = title;
      if (location) property.location = location;
      if (area) property.area = area;
      if (bedrooms) property.bedrooms = bedrooms;
      if (bathrooms) property.bathrooms = bathrooms;
      if (price) property.price = price;
      if (description) property.description = description;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const imageUrls = [];

      for (const file of req.files) {
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(
            `File buffer is empty for file: ${file.originalname}`
          );
        }

        const uniqueKey = `properties/${Date.now()}-${file.originalname}`;
        const command = new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: uniqueKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await s3.send(command);

        // Construct the public URL

        const imageUrl = `https://${S3_BUCKET_NAME}.s3.${S3_BUCKET_REGION}.amazonaws.com/${uniqueKey}`;
        property.Images.push(imageUrl);
        imageUrls.push(imageUrl);
      }

      await property.save();

      // Redirect to the property details page after successful update
      res.redirect(`/properties`);
    } catch (error) {
      console.error("Error updating property:", error);
      res.status(500).json({ message: "Error updating property", error });
    }
  }
);

//add/update description
app.post("/admin-api/upload-property-desc/:id", async (req, res) => {
  const { id } = req.params; // Get property ID from the URL
  const { description } = req.body; // Get description from the request body

  if (!description || description.trim().length === 0) {
    return res.status(400).send("Description cannot be empty.");
  }

  try {
    // Find the property by ID
    const property = await propertyModel.findById(id);

    if (!property) {
      return res.status(404).send("Property not found.");
    }

    // Update the description
    property.description = description;
    await property.save();

    // res.status(200).json({
    //   message: "Description updated successfully",
    //   property,
    // });
    res.redirect(`/properties`);
  } catch (error) {
    console.error("Error updating description:", error.message);
    res.status(500).send("An error occurred while updating the description.");
  }
});

// POST route to create a new blog
app.post(
  "/admin-api/blog/submit",
  upload.array("images", 5),
  async (req, res) => {
    try {
      const { title, content } = req.body;

      // Ensure req.files is populated
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const imageUrls = [];

      // Loop through each uploaded file
      for (const file of req.files) {
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(
            `File buffer is empty for file: ${file.originalname}`
          );
        }

        const uniqueKey = `blogs/${Date.now()}-${file.originalname}`;
        const command = new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: uniqueKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await s3.send(command);

        // Construct the public URL

        const imageUrl = `https://${S3_BUCKET_NAME}.s3.${S3_BUCKET_REGION}.amazonaws.com/${uniqueKey}`;
        imageUrls.push(imageUrl);
      }

      // Create a new blog
      const newBlog = new Blog({
        title,
        content,
        images: imageUrls, // Save the array of public URLs
      });

      await newBlog.save();
      res.redirect("/blog");
    } catch (error) {
      console.error("Error creating blog:", error);
      res.status(500).json({ message: "Error creating the blog post", error });
    }
  }
);


//FRONT-END APIS
app.get("/api/properties", async (req, res) => {
  try {
    const properties = await propertyModel.find();
    // console.log(properties)
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: "Error fetching properties" });
  }
});
// GET a single property by ID
app.get("/api/properties/:id", async (req, res) => {
  try {
    // Find the property in the database using the ID from the URL parameter
    const property = await propertyModel.findById(req.params.id);

    // If no property is found with that ID, return a 404 (Not Found) error
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // If the property is found, send it back as JSON with a 200 (OK) status
    res.status(200).json(property);

  } catch (error) {
    // Log the error for debugging purposes on the server
    console.error("Error fetching property by ID:", error);
    
    // Send a 500 (Internal Server Error) response if something goes wrong
    res.status(500).json({ message: "Error fetching property details", error: error.message });
  }
});

app.get("/api/properties/category-rent/rent", async (req, res) => {
  console.log("👉 RENT API HIT");
  try {
    const properties = await propertyModel.find({
      mainCategory: "Rental",
    });
    console.log("✅ Fetched:", properties.length);
    res.status(200).json(properties);
  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).json({ message: "Error fetching properties", error });
  }
});


app.get("/api/properties/category-residential/residential", async (req, res) => {
  try {
    const properties = await propertyModel.find({
      mainCategory: "Residential",
    });
    // console.log(properties)
    res.status(200).json(properties);
    // console.log(properties);
  } catch (error) {
    res.status(500).json({ message: "Error fetching properties" });
  }
});
app.get("/api/properties/category-commercial/commercial", async (req, res) => {
  try {
    const properties = await propertyModel.find({ mainCategory: "Commercial" });
    // console.log(properties)
    res.status(200).json(properties);
    // console.log(properties);
  } catch (error) {
    res.status(500).json({ message: "Error fetching properties" });
  }
});
app.get("/api/properties/category-offplan/off-plan", async (req, res) => {
  try {
    const properties = await propertyModel.find({ mainCategory: "OffPlan" });
    // console.log(properties)
    res.status(200).json(properties);
    // console.log(properties);
  } catch (error) {
    res.status(500).json({ message: "Error fetching properties" });
  }
});

// POST route to handle user form submission
app.post("/api/contact-user", async (req, res) => {
  try {
    const { name, contactNumber, email, propertyType, propertyArea, message } =
      req.body;

    // Create user object with mandatory fields
    const userData = {
      name,
      contactNumber,
      email,
      message: message || "i am intrested in buying/selling some properties", // Set default message if none provided
    };

    // Add optional fields if they exist
    if (propertyType) {
      userData.propertyType = propertyType;
    }
    if (propertyArea) {
      userData.propertyArea = propertyArea;
    }

    // Save user data to database
    const newUser = new userModel(userData);
    await newUser.save();

    res.status(201).json({ message: "User data submitted successfully!" });
    console.log(newUser);
  } catch (error) {
    res.status(500).json({ message: "Error submitting user data", error });
  }
});

app.get("/users", async (req, res) => {
  const users = await userModel.find();
  console.log(users);
  res.render("users", { users });
});

//search from home page

app.post("/api/search-properties", async (req, res) => {
  const { query, type } = req.body;
console.log(req.body)
  const filters = {};

  if (query) {
    filters.$or = [
      { title: { $regex: query, $options: "i" } }, // Case-insensitive search by title
      { location: { $regex: query, $options: "i" } }, // Case-insensitive search by location
    ];
  }

  if (type) {
    filters.subCategory = type; // Filter by subcategory
  }

  try {
    const properties = await propertyModel.find(filters);
    console.log(properties)
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// search from residential page
app.post("/api/properties/residential/search", async (req, res) => {
  const { query, type, bedrooms } = req.body; // Use req.body for POST requests
  // console.log(req.body);
  const filter = {};

  // General search (location or title)
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
    ];
  }

  // Filter by subCategory (property type)
  if (type) {
    // console.log(type);
    filter.subCategory = type;
  }

  // Filter by bedrooms
  if (bedrooms) {
    // console.log(bedrooms);
    filter.bedrooms = bedrooms;
  }

  try {
    const properties = await propertyModel.find(filter);
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});
app.post("/api/properties/rent/search", async (req, res) => {
  const { query, type, bedrooms } = req.body; // Use req.body for POST requests
  const filter = {
    mainCategory: "Rental" // Add mainCategory filter for rental properties
  };

  // General search (location or title)
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
    ];
  }

  // Filter by subCategory (property type)
  if (type) {
    filter.subCategory = type;
  }

  // Filter by bedrooms
  if (bedrooms) {
    filter.bedrooms = bedrooms;
  }

  try {
    const properties = await propertyModel.find(filter);
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});
app.post("/api/properties/commercial/search", async (req, res) => {
  const { query, type, area } = req.body; // Use req.body for POST requests
  // console.log(req.body);
  const filter = {};

  // General search (location or title)
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
    ];
  }

  // Filter by subCategory (property type)
  if (type) {
    // console.log(type);
    filter.subCategory = type;
  }

  // Filter by bedrooms
  if (area) {
    // console.log(bedrooms);
    filter.area = area;
  }

  try {
    const properties = await propertyModel.find(filter);
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});
app.post("/api/properties/residential/search", async (req, res) => {
  const { query, type, bedrooms } = req.body; // Use req.body for POST requests
  // console.log(req.body);
  const filter = {};

  // General search (location or title)
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
    ];
  }

  // Filter by subCategory (property type)
  if (type) {
    // console.log(type);
    filter.subCategory = type;
  }

  // Filter by bedrooms
  if (bedrooms) {
    // console.log(bedrooms);
    filter.bedrooms = bedrooms;
  }

  try {
    const properties = await propertyModel.find(filter);
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});
app.post("/api/properties/off-plan/search", async (req, res) => {
  const { query, type, area } = req.body; // Use req.body for POST requests
  // console.log(req.body);
  const filter = {};

  // General search (location or title)
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
    ];
  }

  // Filter by subCategory (property type)
  if (type) {
    // console.log(type);
    filter.subCategory = type;
  }

  // Filter by bedrooms
  if (area) {
    // console.log(bedrooms);
    filter.area = area;
  }

  try {
    const properties = await propertyModel.find(filter);
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

//all blog search
app.get("/api/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find(); // Fetch all blogs from the database
    res.status(200).json(blogs);
    console.log(blogs);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ message: "Error fetching blogs", error });
  }
});

//particular blog search
app.get("/api/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id }); // Fetch blog by ID
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.status(200).json(blog);
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({ message: "Error fetching blog", error });
  }
});

function isLoggedIn(req, res, next) {
  try {
    if (req.cookies.token === "") {
      res.send("please login to see this page");
    } else {
      let data = jwt.verify(req.cookies.token, "secret");
      req.user = data;

      next();
    }
  } catch (error) {
    res.send("you must login or register first");
    console.error("you dont have login token", error);
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
