import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshWobbleMaterial, Float, Environment, ContactShadows } from '@react-three/drei';

const Token = ({ color, isCurrent }) => {
    const meshRef = useRef();

    useFrame((state) => {
        if (!meshRef.current) return;
        // Bouncing/Floating animation included in Float but we can add rotation
        meshRef.current.rotation.y += 0.02;
        if (isCurrent) {
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 2) * 0.2;
        }
    });

    return (
        <group dispose={null}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                {/* Pawn Structure composed of Primitives */}
                <group position={[0, 0.5, 0]}>
                    {/* Base */}
                    <mesh position={[0, -0.4, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.4, 0.5, 0.2, 32]} />
                        <meshStandardMaterial color={color} metalness={0.6} roughness={0.2} />
                    </mesh>
                    {/* Mid body */}
                    <mesh position={[0, 0, 0]} castShadow receiveShadow>
                        <coneGeometry args={[0.3, 0.8, 32]} />
                        <meshStandardMaterial color={color} metalness={0.6} roughness={0.2} />
                    </mesh>
                    {/* Head */}
                    <mesh ref={meshRef} position={[0, 0.5, 0]} castShadow receiveShadow>
                        <dodecahedronGeometry args={[0.25, 0]} />
                        <MeshWobbleMaterial factor={isCurrent ? 0.6 : 0} speed={2} color={color} metalness={0.8} roughness={0.1} />
                    </mesh>
                </group>
            </Float>
            <ContactShadows opacity={0.4} scale={2} blur={2.5} far={1.2} />
        </group>
    );
};

const ThreePlayer = ({ color, isCurrent }) => {
    return (
        <div style={{ width: '100px', height: '100px', pointerEvents: 'none' }}>
            <Canvas camera={{ position: [0, 2, 3], fov: 45 }} shadows dpr={[1, 2]}>
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
                <pointLight position={[-10, -10, -10]} intensity={0.5} />
                <Token color={color} isCurrent={isCurrent} />
                <Environment preset="city" />
            </Canvas>
        </div>
    );
};

export default ThreePlayer;
