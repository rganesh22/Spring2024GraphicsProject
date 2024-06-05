SMPL (https://smpl.is.tue.mpg.de/) is a 3D model of the human body. It is based on linear blend skinning and blendshapes, all wrapped up into a nice Python API (smplx), which lets you go from joint angles straight into an articulated mesh.

A helpful document for understanding SMPL’s mesh articulation pipeline, with Python code, can be found here: https://khanhha.github.io/posts/SMPL-model-introduction/

I like this one too: https://files.is.tue.mpg.de/black/talks/SMPL-made-simple-FAQs.pdf

I’m including the following in a zip file:
A single 60-frame motion sequence, as per-frame OBJ files. Getting your renderer to show one or two of these meshes could be a good place to get started: meshes/*
The joint angles for the above motion, stored as an array in a Numpy file: rot_mat.npy
The array is sized [60 x 23 x 3 x 3]. 
60 is the number of frames.
The 24-joint body is represented by 23 relative rotations from parent joints
Each rotation is stored as 3x3 matrices
The global orientation is stored as a [60 x 1 x 3 x 3]. This is the per-frame rotation matrix for the root joint (the hips): global_orient.npy
The translation is stored as a [60 x 1 x 3] matrix. This is the per-frame XYZ global translation of the body: translation.npy
Another good place to get started is to download the SMPL API, call the smpl.forward(betas, pose, global orientation) method on this data, and make sure the output meshes look correct!
Hint 1, see slide 21 https://files.is.tue.mpg.de/black/talks/SMPL-made-simple-FAQs.pdf
Hint 2, smpl.forward() is just about posing the body. You’ll have to add the global translation in to the posed body manually.
 

