setFunction({
  name: 'ring',
  type: 'src',
  inputs: [
    { type: 'float', name: 'thresh1', default: .3 },
    { type: 'float', name: 'thresh2', default: .36 },
    { type: 'float', name: 'thresh3', default: .28 },
    { type: 'float', name: 'thresh4', default: .31 },
  ],
  glsl: `
    vec2 st = _st;
    float pct = distance(st, vec2(0.5));
    float x = smoothstep(thresh1, thresh2, pct);
    float y = smoothstep(thresh3, thresh4, pct);
    vec3 color = vec3(1.0-x-(1.0-y));
    return vec4(color,1.0);
  `
})

setFunction({
  name: 'm_ring',
  type: 'src',
  inputs: [
    { type: 'float', name: 'thresh1', default: .3 },
    { type: 'float', name: 'thresh2', default: .36 },
    { type: 'float', name: 'thresh3', default: .28 },
    { type: 'float', name: 'thresh4', default: .31 },
  ],
  glsl: `
    vec2 st = _st;
    float pct = distance(st, vec2(0.5));
    float x = smoothstep(thresh1, thresh2, pct);
    float y = smoothstep(thresh3, thresh4, pct);
    vec3 gr = vec3(abs(sin(st.x*3.14+time)));
    vec3 color = vec3(1.0-x-(1.0-y)-(gr));
    return vec4(color,1.0);
  `
})

setFunction({
  name: 'mc_ring',
  type: 'src',
  inputs: [
    { type: 'float', name: 'thresh1', default: .3 },
    { type: 'float', name: 'thresh2', default: .36 },
    { type: 'float', name: 'thresh3', default: .28 },
    { type: 'float', name: 'thresh4', default: .31 },
  ],
  glsl: `
    vec2 st = _st;
    float pct = distance(st, vec2(0.5));
    float x = smoothstep(thresh1, thresh2, pct);
    float y = smoothstep(thresh3, thresh4, pct);
    float gr1 = float(abs(sin(st.x*1.57+time)/2.));
    float gr2 = float(abs(sin(st.x*3.14+time)/2.));
    float gr3 = float(abs(sin(st.x*6.28+time)/2.));
    float cl1 = float(1.0-x-(1.0-y)-(gr1));
    float cl2 = float(1.0-x-(1.0-y)-(gr2));
    float cl3 = float(1.0-x-(1.0-y)-(gr3));
    return vec4(cl1,cl2,cl3,1.0);
  `
})
